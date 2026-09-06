import { readFile } from "node:fs/promises";
import { parse as parseDotenv } from "dotenv";
import { parse as parseYaml } from "yaml";

export interface Credential { readonly name: string; readonly key?: string; readonly secret?: string }
export interface CredentialRequest { readonly name: string; readonly keyVariable?: string; readonly secretVariable?: string }
export interface CredentialSource { readonly sourceId: string; resolve(request: CredentialRequest): Credential | undefined | Promise<Credential | undefined> }
export interface CredentialResolution { readonly credential: Credential; readonly sourceId: string }

export async function resolveCredential(request: CredentialRequest, sources: readonly CredentialSource[]): Promise<CredentialResolution | undefined> {
  for (const source of sources) {
    const credential = await source.resolve(request);
    if (credential && (credential.key !== undefined || credential.secret !== undefined)) return Object.freeze({ credential: freezeCredential(credential), sourceId: source.sourceId });
  }
  return undefined;
}

export function credentialDisplay(credential: Credential): Readonly<{ name: string }> { return Object.freeze({ name: credential.name }); }

export function environmentSource(environment: Readonly<Record<string, string | undefined>> = process.env): CredentialSource {
  return Object.freeze({ sourceId: "process-env", resolve: (request: CredentialRequest) => fromVariables(request, environment) });
}

export function dotenvSource(path: string, sourceId = `dotenv:${path}`): CredentialSource {
  let loaded: Promise<Readonly<Record<string, string>>> | undefined;
  return Object.freeze({ sourceId, async resolve(request: CredentialRequest) {
    loaded ??= readText(path).then((text) => text === undefined ? Object.freeze({}) : Object.freeze(parseDotenv(text)));
    return fromVariables(request, await loaded);
  } });
}

export function yamlDotfileSource(path: string, sourceId = `yaml:${path}`): CredentialSource {
  let loaded: Promise<readonly Credential[]> | undefined;
  return Object.freeze({ sourceId, async resolve(request: CredentialRequest) {
    loaded ??= readCredentialsYaml(path);
    return (await loaded).find((credential) => credential.name === request.name);
  } });
}

export function explicitSource(credentials: readonly Credential[], sourceId = "explicit"): CredentialSource {
  const records = credentials.map(freezeCredential);
  return Object.freeze({ sourceId, resolve: (request: CredentialRequest) => records.find((credential) => credential.name === request.name) });
}

export function callbackSource(sourceId: string, resolver: CredentialSource["resolve"]): CredentialSource { return Object.freeze({ sourceId, resolve: resolver }); }

export function standaloneCredentialSources(cwd = process.cwd(), environment: Readonly<Record<string, string | undefined>> = process.env): readonly CredentialSource[] {
  return Object.freeze([environmentSource(environment), dotenvSource(`${cwd}/.env.local`, "dotenv-local"), dotenvSource(`${cwd}/.env`, "dotenv")]);
}

function fromVariables(request: CredentialRequest, values: Readonly<Record<string, string | undefined>>): Credential | undefined {
  const key = request.keyVariable ? values[request.keyVariable] : undefined;
  const secret = request.secretVariable ? values[request.secretVariable] : undefined;
  return key === undefined && secret === undefined ? undefined : freezeCredential({ name: request.name, ...(key !== undefined ? { key } : {}), ...(secret !== undefined ? { secret } : {}) });
}

async function readCredentialsYaml(path: string): Promise<readonly Credential[]> {
  const text = await readText(path);
  if (text === undefined) return Object.freeze([]);
  const document: unknown = parseYaml(text);
  if (!isRecord(document) || !Array.isArray(document.credentials)) throw new TypeError(`${path}: credentials arrayが必要です`);
  return Object.freeze(document.credentials.map((value, index) => parseCredential(value, `${path}:credentials[${index}]`)));
}

function parseCredential(value: unknown, label: string): Credential {
  if (!isRecord(value) || typeof value.name !== "string" || value.name.length === 0) throw new TypeError(`${label}: nameが必要です`);
  if (value.key !== undefined && typeof value.key !== "string") throw new TypeError(`${label}: keyはstringです`);
  if (value.secret !== undefined && typeof value.secret !== "string") throw new TypeError(`${label}: secretはstringです`);
  if (value.key === undefined && value.secret === undefined) throw new TypeError(`${label}: keyまたはsecretが必要です`);
  return freezeCredential({ name: value.name, ...(typeof value.key === "string" ? { key: value.key } : {}), ...(typeof value.secret === "string" ? { secret: value.secret } : {}) });
}

function freezeCredential(value: Credential): Credential { return Object.freeze({ name: value.name, ...(value.key !== undefined ? { key: value.key } : {}), ...(value.secret !== undefined ? { secret: value.secret } : {}) }); }
async function readText(path: string): Promise<string | undefined> { try { return await readFile(path, "utf8"); } catch (error) { if (isRecord(error) && error.code === "ENOENT") return undefined; throw error; } }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
