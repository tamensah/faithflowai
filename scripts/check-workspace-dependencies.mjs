#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";

const ROOT_DIR = process.cwd();
const WORKSPACE_ROOTS = ["apps", "packages"];
const SCAN_DIRS = ["src"];
const SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const IMPORT_PATTERNS = [
  /\bimport\s+(?:[^'"`;]+\s+from\s+)?['"]([^'"\n]+)['"]/g,
  /\bexport\s+[^'"`;]*\s+from\s+['"]([^'"\n]+)['"]/g,
  /\brequire\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  /\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g,
];

const builtins = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listWorkspacePackages() {
  const packages = [];

  for (const workspaceRoot of WORKSPACE_ROOTS) {
    const workspacePath = path.join(ROOT_DIR, workspaceRoot);
    if (!fs.existsSync(workspacePath)) continue;

    const entries = fs.readdirSync(workspacePath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const packagePath = path.join(workspacePath, entry.name);
      const packageJsonPath = path.join(packagePath, "package.json");
      if (!fs.existsSync(packageJsonPath)) continue;

      const packageJson = readJson(packageJsonPath);
      packages.push({
        dir: packagePath,
        relDir: path.relative(ROOT_DIR, packagePath),
        name: packageJson.name,
        packageJson,
      });
    }
  }

  return packages;
}

function collectSourceFiles(packageDir) {
  const files = [];

  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === ".next" ||
          entry.name === "dist" ||
          entry.name === "build"
        ) {
          continue;
        }
        walk(absolutePath);
        continue;
      }

      if (entry.name.endsWith(".d.ts")) continue;
      if (!SCAN_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) continue;
      files.push(absolutePath);
    }
  }

  for (const scanDir of SCAN_DIRS) {
    const scanPath = path.join(packageDir, scanDir);
    if (fs.existsSync(scanPath)) {
      walk(scanPath);
    }
  }

  return files;
}

function extractImportSpecifiers(sourceCode) {
  const imports = [];
  for (const pattern of IMPORT_PATTERNS) {
    let match;
    while ((match = pattern.exec(sourceCode))) {
      imports.push(match[1]);
    }
    pattern.lastIndex = 0;
  }
  return imports;
}

function getPackageNameFromSpecifier(specifier) {
  if (specifier.startsWith("@")) {
    const segments = specifier.split("/");
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : specifier;
  }
  return specifier.split("/")[0];
}

function isInternalAlias(specifier) {
  return (
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("#") ||
    specifier.startsWith("@/")
  );
}

function collectDeclaredDeps(packageJson) {
  return new Set(
    Object.keys({
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
      ...(packageJson.peerDependencies ?? {}),
      ...(packageJson.optionalDependencies ?? {}),
    }),
  );
}

function main() {
  const workspaces = listWorkspacePackages();
  const workspaceNames = new Set(workspaces.map((pkg) => pkg.name).filter(Boolean));

  const violations = [];

  for (const workspace of workspaces) {
    const declaredDeps = collectDeclaredDeps(workspace.packageJson);
    const sourceFiles = collectSourceFiles(workspace.dir);

    for (const filePath of sourceFiles) {
      const sourceCode = fs.readFileSync(filePath, "utf8");
      const importSpecifiers = extractImportSpecifiers(sourceCode);

      for (const specifier of importSpecifiers) {
        if (!specifier || isInternalAlias(specifier)) continue;
        if (specifier.startsWith("node:")) continue;

        const packageName = getPackageNameFromSpecifier(specifier);
        if (!packageName) continue;
        if (builtins.has(specifier) || builtins.has(packageName)) continue;
        if (packageName === workspace.name) continue;

        const isWorkspaceImport = workspaceNames.has(packageName);
        if (!declaredDeps.has(packageName)) {
          violations.push({
            workspace: workspace.relDir,
            file: path.relative(ROOT_DIR, filePath),
            specifier,
            packageName,
            kind: isWorkspaceImport ? "workspace" : "external",
          });
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log("Workspace dependency check passed.");
    return;
  }

  console.error("Workspace dependency drift detected:");
  for (const violation of violations) {
    console.error(
      `- [${violation.workspace}] ${violation.file} imports "${violation.specifier}" but "${violation.packageName}" is not declared in package.json (${violation.kind}).`,
    );
  }
  process.exit(1);
}

main();
