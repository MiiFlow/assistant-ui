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
	color: z.string().optional(),
});

const chartAxisSchema = z.object({
	label: z.string().optional(),
	type: z.enum(["category", "number", "time"]).optional(),
	min: z.number().optional(),
	max: z.number().optional(),
});

export const chartVisualizationSchema = z.object({
	chartType: z.enum(["line", "bar", "pie", "area", "scatter", "composed"]),
	series: z.array(chartSeriesSchema),
	xAxis: chartAxisSchema.optional(),
	yAxis: chartAxisSchema.optional(),
});

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

const tableColumnSchema = z.object({
	key: z.string(),
	label: z.string(),
	type: z.enum(["string", "number", "currency", "date", "badge", "link", "boolean", "progress"]).optional(),
	align: z.enum(["left", "center", "right"]).optional(),
	width: z.string().optional(),
});

export const tableVisualizationSchema = z.object({
	columns: z.array(tableColumnSchema),
	rows: z.array(z.record(z.string(), z.unknown())),
});

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

const cardSectionSchema = z.object({
	title: z.string().optional(),
	items: z.array(z.object({ label: z.string(), value: z.union([z.string(), z.number()]) })).optional(),
	content: z.string().optional(),
});

const cardActionSchema = z.object({
	label: z.string(),
	action: z.string(),
	variant: z.enum(["primary", "secondary", "text"]).optional(),
});

export const cardVisualizationSchema = z.object({
	subtitle: z.string().optional(),
	imageUrl: z.string().optional(),
	sections: z.array(cardSectionSchema),
	actions: z.array(cardActionSchema).optional(),
});

// ---------------------------------------------------------------------------
// KPI
// ---------------------------------------------------------------------------

const kpiMetricSchema = z.object({
	label: z.string(),
	value: z.union([z.string(), z.number()]),
	unit: z.string().optional(),
	trend: z.enum(["up", "down", "neutral"]).optional(),
	change: z.string().optional(),
	changeLabel: z.string().optional(),
	sparkline: z.array(z.number()).optional(),
	color: z.string().optional(),
});

export const kpiVisualizationSchema = z.object({
	metrics: z.array(kpiMetricSchema),
	layout: z.enum(["row", "grid"]).optional(),
});

// ---------------------------------------------------------------------------
// Code Preview
// ---------------------------------------------------------------------------

export const codePreviewVisualizationSchema = z.object({
	code: z.string(),
	language: z.string(),
	lineNumbers: z.boolean().optional(),
	highlightLines: z.array(z.number()).optional(),
	startLine: z.number().optional(),
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
	required: z.boolean().optional(),
	placeholder: z.string().optional(),
	options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
	defaultValue: z.unknown().optional(),
	validation: z
		.object({
			min: z.number().optional(),
			max: z.number().optional(),
			pattern: z.string().optional(),
			message: z.string().optional(),
		})
		.optional(),
});

export const formVisualizationSchema = z.object({
	fields: z.array(formFieldSchema),
	submitAction: z.string().optional(),
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
