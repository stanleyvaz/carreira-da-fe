export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const unauthorized = () => new HttpError(401, "Não autenticado");
export const forbidden = () => new HttpError(403, "Sem permissão");
export const notFound = () => new HttpError(404, "Não encontrado");
