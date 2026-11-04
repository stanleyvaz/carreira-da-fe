import { existsSync } from "node:fs";
import maxmind, { type CityResponse, type Reader } from "maxmind";

/** País/UF a partir do IP, com base GeoIP local (DB-IP Lite, CC BY 4.0). O IP nunca é gravado. */
export type Geo = { country: string; region: string };
const UNKNOWN: Geo = { country: "??", region: "" };

const UF: Record<string, string> = {
  "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM", "Bahia": "BA", "Ceará": "CE", "Federal District": "DF", "Distrito Federal": "DF",
  "Espírito Santo": "ES", "Goiás": "GO", "Maranhão": "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS", "Minas Gerais": "MG", "Pará": "PA",
  "Paraíba": "PB", "Paraná": "PR", "Pernambuco": "PE", "Piauí": "PI", "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS",
  "Rondônia": "RO", "Roraima": "RR", "Santa Catarina": "SC", "São Paulo": "SP", "Sergipe": "SE", "Tocantins": "TO",
};

let reader: Promise<Reader<CityResponse> | null> | null = null;
function open() {
  if (!reader) {
    const path = process.env.GEOIP_DB;
    reader = path && existsSync(path) ? maxmind.open<CityResponse>(path).catch(() => null) : Promise.resolve(null);
  }
  return reader;
}

const PRIVATE = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|fc|fd|fe80:|local$)/i;

export async function geoOf(ip: string | null | undefined): Promise<Geo> {
  if (!ip || PRIVATE.test(ip) || !maxmind.validate(ip)) return UNKNOWN;
  const r = await open();
  if (!r) return UNKNOWN;
  try {
    const g = r.get(ip);
    const country = g?.country?.iso_code ?? "??";
    const sub = g?.subdivisions?.[0];
    const name = sub?.names?.en ?? sub?.names?.["pt-BR"] ?? "";
    const region = country === "BR" ? (UF[name] ?? sub?.iso_code ?? name) : (sub?.iso_code ?? name);
    return { country, region: (region ?? "").slice(0, 60) };
  } catch { return UNKNOWN; }
}
