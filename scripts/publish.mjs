#!/usr/bin/env node

import { chmod, mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";

const [, , inputArgument, title = ""] = process.argv;
if (!inputArgument) fail("Usage: node publish.mjs <html-file> [title]");

const inputPath = resolve(inputArgument);
let inputStats;
try { inputStats = await stat(inputPath); }
catch (error) { fail(`Unable to read ${inputPath}: ${error instanceof Error ? error.message : String(error)}`); }
const inputKind = inputStats.isDirectory() ? "directory" : /\.zip$/i.test(inputPath) ? "zip" : "html";
const projectDirectory = inputKind === "directory" ? inputPath : dirname(inputPath);
const stateFile = join(projectDirectory, ".yezhou.json");
const baseUrl = (process.env.YEZHOU_BASE_URL || "https://yz.gbfeng.com").replace(/\/$/, "");
const configRoot = process.env.YEZHOU_CONFIG_DIR || (platform() === "win32"
  ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "yezhou")
  : join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "yezhou"));
const credentialFile = join(configRoot, "credentials");

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function api(path, options = {}) {
  let response;
  try { response = await fetch(`${baseUrl}${path}`, options); }
  catch (error) { fail(`Unable to connect to 页舟: ${error instanceof Error ? error.message : String(error)}`); }
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function openBrowser(url) {
  const command = platform() === "win32" ? "cmd" : platform() === "darwin" ? "open" : "xdg-open";
  const args = platform() === "win32" ? ["/c", "start", "", url] : [url];
  try {
    const child = spawn(command, args, { detached:true, stdio:"ignore", windowsHide:true });
    child.unref();
    return true;
  } catch { return false; }
}

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function authorize() {
  const { response, body } = await api("/api/agent/device/code", {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({label:`页舟 Deploy · ${platform()}`}),
  });
  if (!response.ok || !body.deviceCode || !body.verificationUriComplete) fail(body.error || "Unable to start browser authorization.");
  console.log(`Authorization code: ${body.userCode}`);
  console.log(`Open this page to authorize 页舟: ${body.verificationUriComplete}`);
  if (!openBrowser(body.verificationUriComplete)) console.log("The browser could not be opened automatically. Open the URL above manually.");
  const interval = Math.max(2, Number(body.interval) || 2) * 1000;
  const deadline = Date.now() + Math.max(60, Number(body.expiresIn) || 600) * 1000;
  while (Date.now() < deadline) {
    const tokenResult = await api("/api/agent/device/token", {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({deviceCode:body.deviceCode}),
    });
    if (tokenResult.response.ok && tokenResult.body.accessToken) {
      await mkdir(configRoot, {recursive:true,mode:0o700});
      await writeFile(credentialFile, `${tokenResult.body.accessToken}\n`, {encoding:"utf8",mode:0o600});
      if (platform() !== "win32") await Promise.all([chmod(configRoot,0o700),chmod(credentialFile,0o600)]);
      console.log("Authorized successfully.");
      return tokenResult.body.accessToken;
    }
    if (tokenResult.body.error !== "authorization_pending") fail(`Authorization failed: ${tokenResult.body.error || "unknown_error"}`);
    await sleep(interval);
  }
  fail("Authorization timed out. Run the publish command again to retry.");
}

async function savedCredential() {
  try { return (await readFile(credentialFile,"utf8")).trim(); }
  catch { return ""; }
}

async function directoryFiles(directory,prefix="") {
  const entries=await readdir(directory,{withFileTypes:true}),files=[];
  for(const entry of entries){
    if(entry.name.startsWith(".")||entry.name==="node_modules")continue;
    const absolute=join(directory,entry.name),relative=prefix?`${prefix}/${entry.name}`:entry.name;
    if(entry.isDirectory())files.push(...await directoryFiles(absolute,relative));
    else if(entry.isFile())files.push({absolute,relative});
  }
  return files;
}

async function projectPayload() {
  const form=new FormData();if(title)form.set("title",title);
  if(inputKind==="zip"){form.set("archive",new Blob([await readFile(inputPath)],{type:"application/zip"}),inputPath.split(/[\\/]/).pop()||"project.zip");return form;}
  const files=await directoryFiles(inputPath);if(!files.length)fail("The project directory is empty.");
  for(const file of files)form.append("files",new Blob([await readFile(file.absolute)]),file.relative.split("/").pop());
  form.set("paths",JSON.stringify(files.map(file=>file.relative)));return form;
}

async function publish(accessToken, payload, siteId) {
  const project=inputKind!=="html",basePath=project?"/api/agent/projects":"/api/agent/sites";
  return api(siteId ? `${basePath}/${encodeURIComponent(siteId)}` : basePath, {
    method:siteId ? "PUT" : "POST",
    headers:{Authorization:`Bearer ${accessToken}`,...(project?{}:{"Content-Type":"application/json; charset=utf-8"})},
    body:project?payload:JSON.stringify(payload),
  });
}

let payload;
if(inputKind==="html"){
  let html;try{html=await readFile(inputPath,"utf8");}catch(error){fail(`Unable to read ${inputPath}: ${error instanceof Error?error.message:String(error)}`);}
  payload={html,title};
}else payload=await projectPayload();

let state = {};
try { state = JSON.parse(await readFile(stateFile,"utf8")); } catch { /* A first publish has no project state yet. */ }
let accessToken = await savedCredential();
if (!accessToken) accessToken = await authorize();

let result = await publish(accessToken,payload,typeof state.siteId === "string" ? state.siteId : "");
if (result.response.status === 401) {
  await unlink(credentialFile).catch(()=>{});
  accessToken = await authorize();
  result = await publish(accessToken,payload,typeof state.siteId === "string" ? state.siteId : "");
}
if (!result.response.ok || !result.body.url || !result.body.id) fail(result.body.error || `Publish failed with HTTP ${result.response.status}.`);
await writeFile(stateFile,`${JSON.stringify({siteId:result.body.id,url:result.body.url},null,2)}\n`,"utf8");
console.log(`${result.body.created ? "Published" : "Updated"}: ${result.body.url}`);
