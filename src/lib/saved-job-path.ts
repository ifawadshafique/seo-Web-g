export function validSavedJobSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 200 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

export function savedJobSignInPath(slug: string) {
  return "/account/sign-in?" + new URLSearchParams({ save: slug });
}
