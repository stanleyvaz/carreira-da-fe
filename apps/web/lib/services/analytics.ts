import { z } from "zod";
import { MIN_GROUP_SIZE, suppressSmall, type Role } from "@jornada/shared";
import { one, q } from "../db";
import { forbidden, notFound } from "../errors";
import { TODAY } from "./usage";

/**
 * Indicadores de uso para o CMS (administradores e analistas). LGPD: só agregados.
 * - Contagens de pessoas abaixo de MIN_GROUP_SIZE viram null ("menos de 5").
 * - Taxas só aparecem quando o grupo de base tem ao menos MIN_GROUP_SIZE pessoas.
 * - Nenhum identificador, e-mail ou conteúdo de anotação sai daqui.
 */
type Actor = { id: string; role: Role };
const can = (a: Actor) => { if (!["admin", "analyst"].includes(a.role)) throw forbidden(); };
const S = suppressSmall;
const rate = (num: number, den: number) => (den >= MIN_GROUP_SIZE ? Math.round((num / den) * 1000) / 10 : null);
/** Uma jornada é "abandonada" quando foi começada, não foi concluída e está parada há mais de N dias. */
export const ABANDON_DAYS = 14;

// Progresso por pessoa e jornada: etapas feitas, total de etapas, primeira e última atividade.
const JOURNEY_PROGRESS = `
  SELECT p.user_id, p.journey_id, count(*)::int AS done, min(p.completed_at) AS started_at, max(p.completed_at) AS last_at,
         (SELECT count(*) FROM journey_steps s WHERE s.journey_id=p.journey_id)::int AS total
    FROM user_progress p JOIN users u ON u.id=p.user_id AND u.role='user'
   WHERE p.kind='step' AND p.journey_id IS NOT NULL GROUP BY p.user_id, p.journey_id`;

const periodSchema = z.coerce.number().int().refine((n) => [7, 30, 90, 365].includes(n), "Período inválido").default(30);

export async function dashboard(a: Actor, daysInput?: unknown) {
  can(a);
  const days = periodSchema.parse(daysInput ?? 30);
  const P = `d.day > ${TODAY} - ${days}`;
  const [users, series, countries, regions, areas, consenting, completion, items, library, passages, devices, topics, retention] = await Promise.all([
    one(`SELECT
        (SELECT count(*) FROM users WHERE role='user')::int AS registered,
        (SELECT count(*) FROM users WHERE role='user' AND created_at > now() - make_interval(days => ${days}))::int AS "newInPeriod",
        (SELECT count(*) FROM users WHERE role='user' AND blocked_at IS NOT NULL)::int AS blocked,
        (SELECT count(DISTINCT d.user_id) FROM user_activity_days d JOIN users u ON u.id=d.user_id AND u.role='user' WHERE d.day = ${TODAY})::int AS today,
        (SELECT count(DISTINCT d.user_id) FROM user_activity_days d JOIN users u ON u.id=d.user_id AND u.role='user' WHERE d.day > ${TODAY} - 7)::int AS "last7",
        (SELECT count(DISTINCT d.user_id) FROM user_activity_days d JOIN users u ON u.id=d.user_id AND u.role='user' WHERE ${P})::int AS period,
        (SELECT count(*) FROM user_activity_days d JOIN users u ON u.id=d.user_id AND u.role='user' WHERE ${P})::int AS "userDays"`),
    q(`SELECT g.day::date::text AS day,
          (SELECT count(*) FROM user_activity_days d JOIN users u ON u.id=d.user_id AND u.role='user' WHERE d.day=g.day)::int AS active,
          (SELECT count(*) FROM users u WHERE u.role='user' AND (u.created_at AT TIME ZONE 'America/Sao_Paulo')::date = g.day)::int AS signups
        FROM generate_series(${TODAY} - ${days - 1}, ${TODAY}, interval '1 day') AS g(day) ORDER BY 1`),
    q(`SELECT country, sum(users)::int AS n FROM geo_daily d WHERE ${P} GROUP BY country ORDER BY n DESC LIMIT 30`),
    q(`SELECT region, sum(users)::int AS n FROM geo_daily d WHERE ${P} AND country='BR' AND region<>'' GROUP BY region ORDER BY n DESC`),
    q(`SELECT area, sum(visits)::int AS visits, sum(seconds)::bigint AS seconds FROM area_time_daily d WHERE ${P} GROUP BY area ORDER BY seconds DESC`),
    one(`SELECT count(*)::int AS n FROM (
           SELECT DISTINCT ON (c.user_id) c.granted FROM user_consents c JOIN users u ON u.id=c.user_id AND u.role='user'
            WHERE c.purpose='aggregate_analytics' ORDER BY c.user_id, c.created_at DESC) x WHERE granted`),
    one(`SELECT count(*)::int AS started,
          count(*) FILTER (WHERE done >= total AND total > 0)::int AS completed,
          count(*) FILTER (WHERE done < total AND last_at < now() - interval '${ABANDON_DAYS} days')::int AS abandoned,
          count(*) FILTER (WHERE done < total AND last_at >= now() - interval '${ABANDON_DAYS} days')::int AS "inProgress",
          count(DISTINCT user_id)::int AS "usersStarted",
          count(DISTINCT user_id) FILTER (WHERE done >= total AND total > 0)::int AS "usersCompleted"
        FROM (${JOURNEY_PROGRESS}) jp`),
    one(`SELECT count(*) FILTER (WHERE kind='step')::int AS steps, count(*) FILTER (WHERE kind='reflection')::int AS reflections,
          count(*) FILTER (WHERE kind='activity')::int AS activities, count(DISTINCT p.user_id)::int AS "usersAny"
        FROM user_progress p JOIN users u ON u.id=p.user_id AND u.role='user' WHERE p.completed_at > now() - make_interval(days => ${days})`),
    one(`SELECT (SELECT count(*) FROM private_notes)::int AS notes, (SELECT count(DISTINCT user_id) FROM private_notes)::int AS "usersWithNotes",
          (SELECT count(*) FROM user_bookmarks)::int AS bookmarks, (SELECT count(DISTINCT user_id) FROM user_bookmarks)::int AS "usersWithBookmarks",
          (SELECT count(*) FROM private_notes WHERE created_at > now() - make_interval(days => ${days}))::int AS "notesInPeriod",
          (SELECT count(*) FROM user_bookmarks WHERE created_at > now() - make_interval(days => ${days}))::int AS "bookmarksInPeriod"`),
    q(`SELECT p.book||' '||p.chapter||':'||p.verse_start||CASE WHEN p.verse_end>p.verse_start THEN '-'||p.verse_end ELSE '' END AS reference,
          count(DISTINCT b.user_id)::int AS users
        FROM user_bookmarks b JOIN bible_passages p ON p.id=b.passage_id GROUP BY 1 HAVING count(DISTINCT b.user_id) >= ${MIN_GROUP_SIZE}
        ORDER BY users DESC LIMIT 10`),
    q(`SELECT platform, count(DISTINCT user_id)::int AS users FROM devices GROUP BY platform`),
    q(`SELECT tp.name, count(DISTINCT up.user_id)::int AS users FROM user_progress up
        JOIN journey_steps s ON s.id=up.ref_id AND up.kind='step' JOIN learning_journeys j ON j.id=s.journey_id
        JOIN topics tp ON tp.id=j.topic_id WHERE up.completed_at > now() - make_interval(days => ${days}) GROUP BY tp.name ORDER BY users DESC`),
    one(`WITH c AS (SELECT u.id, (u.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d0 FROM users u
                    WHERE u.role='user' AND u.created_at > now() - make_interval(days => ${days + 30}))
         SELECT count(*) FILTER (WHERE d0 <= ${TODAY} - 7)::int AS "cohort7",
                count(*) FILTER (WHERE d0 <= ${TODAY} - 7 AND EXISTS (SELECT 1 FROM user_activity_days a WHERE a.user_id=c.id AND a.day BETWEEN d0 + 1 AND d0 + 7))::int AS "back7",
                count(*) FILTER (WHERE d0 <= ${TODAY} - 30)::int AS "cohort30",
                count(*) FILTER (WHERE d0 <= ${TODAY} - 30 AND EXISTS (SELECT 1 FROM user_activity_days a WHERE a.user_id=c.id AND a.day BETWEEN d0 + 8 AND d0 + 30))::int AS "back30"
           FROM c`),
  ]);
  const u = users as any, c = completion as any, it = items as any, lib = library as any, r = retention as any;
  const avgDaily = days > 0 ? Math.round((u.userDays / days) * 10) / 10 : 0;
  return {
    period: { days },
    users: {
      registered: u.registered, newInPeriod: u.newInPeriod, blocked: u.blocked,
      activeToday: S(u.today), active7: S(u.last7), activePeriod: S(u.period),
      avgDailyActive: u.period >= MIN_GROUP_SIZE ? avgDaily : null,
      avgActiveDaysPerUser: u.period >= MIN_GROUP_SIZE ? Math.round((u.userDays / u.period) * 10) / 10 : null,
      stickiness: u.period >= MIN_GROUP_SIZE ? Math.round((avgDaily / u.period) * 1000) / 10 : null,
      retention7: rate(r.back7, r.cohort7), retention30: rate(r.back30, r.cohort30),
    },
    series: (series as any[]).map((x) => ({ day: x.day, active: S(x.active), signups: x.signups })),
    geo: {
      countries: (countries as any[]).map((x) => ({ country: x.country, userDays: S(x.n) })),
      regionsBR: (regions as any[]).map((x) => ({ region: x.region, userDays: S(x.n) })),
    },
    areas: {
      consenting: S((consenting as any)?.n ?? 0),
      items: (areas as any[]).map((x) => ({ area: x.area, visits: x.visits, totalMinutes: Math.round(Number(x.seconds) / 60), avgSeconds: x.visits ? Math.round(Number(x.seconds) / x.visits) : 0 })),
    },
    completion: {
      journeysStarted: c.started, journeysCompleted: c.completed, journeysAbandoned: c.abandoned, journeysInProgress: c.inProgress,
      completionRate: rate(c.completed, c.started), abandonRate: rate(c.abandoned, c.started),
      usersStarted: S(c.usersStarted), usersCompleted: S(c.usersCompleted), usersFinishRate: rate(c.usersCompleted, c.usersStarted),
      abandonAfterDays: ABANDON_DAYS,
      period: { steps: it.steps, reflections: it.reflections, activities: it.activities, usersAny: S(it.usersAny) },
    },
    library: { notes: lib.notes, notesInPeriod: lib.notesInPeriod, usersWithNotes: S(lib.usersWithNotes), bookmarks: lib.bookmarks,
      bookmarksInPeriod: lib.bookmarksInPeriod, usersWithBookmarks: S(lib.usersWithBookmarks), topPassages: passages },
    devices: (devices as any[]).map((x) => ({ platform: x.platform, users: S(x.users) })),
    topics: (topics as any[]).map((x) => ({ name: x.name, users: S(x.users) })),
  };
}

/** Uma linha por jornada/desafio publicado ou arquivado: aberturas, inícios, andamento, conclusões e abandonos. */
export async function contentMetrics(a: Actor, daysInput?: unknown) {
  can(a);
  const days = periodSchema.parse(daysInput ?? 30);
  const rows = await q(`
    WITH jp AS (${JOURNEY_PROGRESS})
    SELECT j.id, j.title, j.kind, j.status, tp.name AS topic,
      (SELECT count(*) FROM journey_steps s WHERE s.journey_id=j.id)::int AS steps,
      (SELECT coalesce(sum(opens),0) FROM content_daily d WHERE d.kind='journey' AND d.content_id=j.id AND d.day > ${TODAY} - ${days})::int AS opens,
      count(jp.user_id)::int AS starts,
      count(jp.user_id) FILTER (WHERE jp.done >= jp.total AND jp.total > 0)::int AS completed,
      count(jp.user_id) FILTER (WHERE jp.done < jp.total AND jp.last_at < now() - interval '${ABANDON_DAYS} days')::int AS abandoned,
      count(jp.user_id) FILTER (WHERE jp.done < jp.total AND jp.last_at >= now() - interval '${ABANDON_DAYS} days')::int AS "inProgress",
      round(avg(EXTRACT(EPOCH FROM jp.last_at - jp.started_at)/86400) FILTER (WHERE jp.done >= jp.total AND jp.total > 0)::numeric, 1)::float AS "avgDaysToComplete",
      (SELECT count(*) FROM user_bookmarks b JOIN journey_steps s ON s.passage_id=b.passage_id WHERE s.journey_id=j.id)::int AS bookmarks,
      (SELECT count(*) FROM private_notes n JOIN journey_steps s ON n.ref_kind='step' AND s.id=n.ref_id WHERE s.journey_id=j.id)::int AS notes
    FROM learning_journeys j LEFT JOIN topics tp ON tp.id=j.topic_id LEFT JOIN jp ON jp.journey_id=j.id
    WHERE j.status IN ('published','archived') GROUP BY j.id, tp.name ORDER BY starts DESC, opens DESC, j.title`);
  const reflections = await q(`SELECT r.id, r.title, r.publish_date::text AS "publishDate",
      (SELECT count(*) FROM user_progress p WHERE p.kind='reflection' AND p.ref_id=r.id)::int AS completed,
      (SELECT count(*) FROM private_notes n WHERE n.ref_kind='reflection' AND n.ref_id=r.id)::int AS notes
    FROM reflections r WHERE r.status='published' AND r.publish_date > ${TODAY} - ${days} AND r.publish_date <= ${TODAY} ORDER BY r.publish_date DESC`);
  const activities = await q(`SELECT a.id, a.title,
      (SELECT count(*) FROM user_progress p WHERE p.kind='activity' AND p.ref_id=a.id AND p.completed_at > now() - make_interval(days => ${days}))::int AS completed
    FROM practical_activities a WHERE a.status='published' ORDER BY completed DESC, a.title LIMIT 50`);
  const resources = await q(`SELECT r.id, r.title, r.kind, coalesce(sum(d.opens),0)::int AS opens
    FROM resources r LEFT JOIN content_daily d ON d.kind='resource' AND d.content_id=r.id AND d.day > ${TODAY} - ${days}
    WHERE r.status='published' GROUP BY r.id ORDER BY opens DESC, r.title LIMIT 50`);
  return {
    period: { days }, abandonAfterDays: ABANDON_DAYS,
    journeys: (rows as any[]).map((x) => ({ ...x,
      starts: S(x.starts), completed: S(x.completed), abandoned: S(x.abandoned), inProgress: S(x.inProgress),
      completionRate: rate(x.completed, x.starts), abandonRate: rate(x.abandoned, x.starts),
      avgDaysToComplete: x.completed >= MIN_GROUP_SIZE ? x.avgDaysToComplete : null })),
    reflections: (reflections as any[]).map((x) => ({ ...x, completed: S(x.completed) })),
    activities: (activities as any[]).map((x) => ({ ...x, completed: S(x.completed) })),
    resources,
  };
}

/** Funil de uma jornada: quantas pessoas chegaram a cada etapa, aberturas por etapa e aberturas por dia. */
export async function journeyFunnel(a: Actor, id: string, daysInput?: unknown) {
  can(a);
  const days = periodSchema.parse(daysInput ?? 30);
  const j = await one(`SELECT id, title, kind, status FROM learning_journeys WHERE id=$1 AND status IN ('published','archived')`, [z.string().uuid().parse(id)]);
  if (!j) throw notFound();
  const steps = await q(`SELECT s.position, s.title,
      (SELECT count(DISTINCT p.user_id) FROM user_progress p JOIN users u ON u.id=p.user_id AND u.role='user' WHERE p.kind='step' AND p.ref_id=s.id)::int AS completed,
      (SELECT coalesce(sum(opens),0) FROM content_daily d WHERE d.kind='step' AND d.content_id=s.id AND d.day > ${TODAY} - ${days})::int AS opens
    FROM journey_steps s WHERE s.journey_id=$1 ORDER BY s.position`, [j.id]);
  const opens = await q(`SELECT g.day::date::text AS day, coalesce((SELECT opens FROM content_daily d WHERE d.kind='journey' AND d.content_id=$1 AND d.day=g.day),0)::int AS opens
    FROM generate_series(${TODAY} - ${days - 1}, ${TODAY}, interval '1 day') AS g(day) ORDER BY 1`, [j.id]);
  return { ...j, period: { days }, steps: (steps as any[]).map((x) => ({ ...x, completed: S(x.completed) })), opens };
}
