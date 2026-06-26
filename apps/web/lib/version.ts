import webPackage from "../package.json";

function shortCommit(value: string | undefined): string | undefined {
  const commit = value?.trim();
  return commit ? commit.slice(0, 7) : undefined;
}

export function getAppVersion(): string {
  const explicitVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.APP_VERSION;
  const commit =
    shortCommit(process.env.RAILWAY_GIT_COMMIT_SHA) ??
    shortCommit(process.env.VERCEL_GIT_COMMIT_SHA) ??
    shortCommit(process.env.GIT_COMMIT_SHA) ??
    shortCommit(process.env.SOURCE_VERSION);

  if (explicitVersion) {
    return commit ? `${explicitVersion}+${commit}` : explicitVersion;
  }

  return commit ? `${webPackage.version}+${commit}` : webPackage.version;
}
