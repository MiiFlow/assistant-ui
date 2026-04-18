import { z } from "zod";
import { registerBuiltinSchemas } from "./registry";

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------

const chartSeriesSchema = z.object({
	name: z.string(),
	data: z.array(
		z.union([
			z.object({ x: z.union([z.string(), z.number()]), y: z.number() }),
			z.object({ name: z.string(), value: z.number() }),
		]),
	),
	color: z.string().nullish(),
});

const chartAxisSchema = z.object({
	label: z.string().nullish(),
	type: z.enum(["category", "number", "time"]).nullish(),
	min: z.number().nullish(),
	max: z.number().nullish(),
});

export const chartVisualizationSchema = z.object({
	chartType: z.enum(["line", "bar", "pie", "area", "scatter", "composed"]),
	series: z.array(chartSeriesSchema),
	xAxis: chartAxisSchema.nullish(),
	yAxis: chartAxisSchema.nullish(),
});

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

const tableColumnSchema = z.object({
	key: z.string(),
	label: z.string(),
	type: z.enum(["string", "number", "currency", "date", "badge", "link", "boolean", "progress", "media"]).nullish(),
	align: z.enum(["left", "center", "right"]).nullish(),
	width: z.string().nullish(),
});

export const tableVisualizationSchema = z.object({
	columns: z.array(tableColumnSchema),
	rows: z.array(z.record(z.string(), z.unknown())),
});

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

const cardSectionSchema = z.object({
	title: z.string().nullish(),
	items: z.array(z.object({ label: z.string(), value: z.union([z.string(), z.number()]) })).nullish(),
	content: z.string().nullish(),
});

const cardActionSchema = z.object({
	label: z.string(),
	action: z.string(),
	variant: z.enum(["primary", "secondary", "text"]).nullish(),
});

export const cardVisualizationSchema = z.object({
	subtitle: z.string().nullish(),
	imageUrl: z.string().nullish(),
	sections: z.array(cardSectionSchema),
	actions: z.array(cardActionSchema).nullish(),
});

// ---------------------------------------------------------------------------
// KPI
// ---------------------------------------------------------------------------

const kpiMetricSchema = z.object({
	label: z.string(),
	value: z.union([z.string(), z.number()]),
	unit: z.string().nullish(),
	trend: z.enum(["up", "down", "neutral"]).nullish(),
	change: z.union([z.string(), z.number()]).nullish(),
	changeLabel: z.string().nullish(),
	sparkline: z.array(z.number()).nullish(),
	color: z.string().nullish(),
});

export const kpiVisualizationSchema = z.object({
	metrics: z.array(kpiMetricSchema),
	layout: z.enum(["row", "grid"]).nullish(),
});

// ---------------------------------------------------------------------------
// Code Preview
// ---------------------------------------------------------------------------

export const codePreviewVisualizationSchema = z.object({
	code: z.string(),
	language: z.string(),
	lineNumbers: z.boolean().nullish(),
	highlightLines: z.array(z.number()).nullish(),
	startLine: z.number().nullish(),
});

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

const formFieldSchema = z.object({
	name: z.string(),
	type: z.enum([
		"text",
		"number",
		"email",
		"select",
		"multiselect",
		"checkbox",
		"radio",
		"textarea",
		"date",
		"datetime",
	]),
	label: z.string(),
	required: z.boolean().nullish(),
	placeholder: z.string().nullish(),
	options: z.array(z.object({ value: z.string(), label: z.string() })).nullish(),
	defaultValue: z.unknown().nullish(),
	validation: z
		.object({
			min: z.number().nullish(),
			max: z.number().nullish(),
			pattern: z.string().nullish(),
			message: z.string().nullish(),
		})
		.nullish(),
});

export const formVisualizationSchema = z.object({
	fields: z.array(formFieldSchema),
	submitAction: z.string().nullish(),
});

// ---------------------------------------------------------------------------
// Auto-register schemas with the registry
// ---------------------------------------------------------------------------

registerBuiltinSchemas({
	chart: chartVisualizationSchema,
	table: tableVisualizationSchema,
	card: cardVisualizationSchema,
	kpi: kpiVisualizationSchema,
	code_preview: codePreviewVisualizationSchema,
	form: formVisualizationSchema,
});
