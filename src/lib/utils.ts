export type ClassValue = string | number | null | false | undefined;

/** Join truthy class names into a single string. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
