import type { SubagentChunkData } from "../../types";
import { MarkdownContent } from "../MarkdownContent";
import { ink } from "./atoms";
import { buildRunSteps } from "./build-steps";
import { ToolChip } from "./ToolChip";

/**
 * Turn an LLM-facing handle ("google_ads_specialist") into a human label
 * ("Google Ads Specialist").
 */
export function humanizeHandle(handle: string): string {
	if (!handle) return "Specialist";
	return handle
		.split(/[_-]+/)
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

/**
 * Monogram for the avatar: "Google Ads Specialist" → "GA", "Budget
 * Specialist" → "BU".
 *
 * The role noun is dropped because the distinguishing part of a handle is what
 * comes BEFORE it — every specialist would otherwise collapse toward "…S". A
 * handle with only one meaningful word takes two letters of it rather than
 * standing as a lone initial, which reads as a stray character at 24px.
 */
export function initials(handle: string): string {
	const words = handle.split(/[_\-\s]+/).filter(Boolean);
	const meaningful = words.filter((w) => !/^(specialist|agent|assistant|bot)$/i.test(w));
	const source = meaningful.length > 0 ? meaningful : words;
	if (source.length === 0) return "";
	if (source.length === 1) return source[0]!.slice(0, 2).toUpperCase();
	return source
		.slice(0, 2)
		.map((w) => w[0]!.toUpperCase())
		.join("");
}

/**
 * The nested work one specialist did: its steps, its tool chips, its answer.
 *
 * Body only — the header, the status and the disclosure belong to
 * `SubagentGroup`, which renders them the same way whether the parent step
 * dispatched one specialist or gathered five. Splitting them is what stops the
 * single-dispatch case being a second implementation of the group.
 */
export function SubagentBody({ data }: { data: SubagentChunkData }) {
	const isRunning = data.status === "running";
	const nested = buildRunSteps(data.nestedChunks, isRunning);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 9, minWidth: 0 }}>
			{nested.map((step) => (
				<div key={step.id} style={{ minWidth: 0 }}>
					{step.text && (
						<div
							style={{
								fontSize: 13.5,
								lineHeight: 1.6,
								letterSpacing: "-0.004em",
								color: ink(70),
							}}
						>
							<MarkdownContent className="text-[13.5px]">{step.text}</MarkdownContent>
						</div>
					)}
					{step.tools.length > 0 && (
						<div
							style={{
								marginTop: step.text ? 6 : 0,
								display: "flex",
								flexWrap: "wrap",
								alignItems: "center",
								gap: 7,
							}}
						>
							{step.tools.map((tool) => (
								<ToolChip key={tool.id} tool={tool} />
							))}
						</div>
					)}
				</div>
			))}

			{/* A transferred sub-agent answered the user directly, so its reply is
			    the message body — repeating it here would show the same text twice. */}
			{data.result && !data.transferred && (
				<div style={{ fontSize: 13.5, lineHeight: 1.6, color: ink(74) }}>
					<MarkdownContent className="text-[13.5px]">{data.result}</MarkdownContent>
				</div>
			)}

			{nested.length === 0 && !data.result && (
				<span style={{ fontSize: 12.5, color: ink(38) }}>
					{isRunning ? "Starting up" : "No steps recorded"}
				</span>
			)}
		</div>
	);
}
