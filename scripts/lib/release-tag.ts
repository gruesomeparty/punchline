/**
 * Release tag check. A tag like v1.2.3 publishes punchline-1.2.3.zip, so the tag, package.json
 * and the manifest must all agree, or the store would get a zip whose version nobody tagged.
 */
const TAG = /^v(\d+\.\d+\.\d+)$/;

// Chrome accepts up to four dot-separated integers from 0 to 65535 and rejects an all-zero version.
const MAX_PART = 65535;

export function validateReleaseTag(
  tag: string,
  packageVersion: string,
  manifestVersion: string,
): string[] {
  const match = TAG.exec(tag);
  if (!match) return [`tag "${tag}" must look like v1.2.3`];

  const version = match[1] as string;
  const errors: string[] = [];
  const parts = version.split('.').map(Number);
  if (parts.some((part) => part > MAX_PART)) {
    errors.push(`version ${version} has a part above ${MAX_PART}, which Chrome rejects`);
  }
  if (parts.every((part) => part === 0)) {
    errors.push(`version ${version} is all zeros, which Chrome rejects`);
  }
  if (packageVersion !== version) {
    errors.push(`package.json version "${packageVersion}" does not match tag ${tag}`);
  }
  if (manifestVersion !== version) {
    errors.push(`src/manifest.json version "${manifestVersion}" does not match tag ${tag}`);
  }
  return errors;
}
