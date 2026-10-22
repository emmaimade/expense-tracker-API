// Escape user input so it matches literally inside a RegExp / $regex
export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default { escapeRegex };
