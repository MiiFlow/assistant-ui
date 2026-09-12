/**
 * A tool name as a reader would say it: "apply_report_patch" becomes
 * "Apply report patch", "getAdPerformance" becomes "Get ad performance".
 *
 * Only for a call that arrived without a description. The raw name still
 * belongs in the hover title, and in every lookup keyed on the name
 * (internal-tool filtering, matching an observation to its call), so this is
 * applied at the label and nowhere upstream of it.
 *
 * A name that already has spaces was written for people, and is kept as it is.
 */
export function humanizeToolName(name?: string): string {
	const raw = (name ?? "").trim();
	if (!raw) return "Tool call";
	if (/\s/.test(raw) && !/[_-]/.test(raw)) return raw;
	const sentence = raw
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.split(/[\s_-]+/)
		.filter(Boolean)
		.map((word) => word.toLowerCase())
		.join(" ");
	return sentence ? sentence.charAt(0).toUpperCase() + sentence.slice(1) : "Tool call";
}
