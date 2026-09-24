import { demos, type DemoId } from './lab';
export type LabActions = {
  select: (id: DemoId) => void;
  reset: () => void;
  pause: (paused: boolean) => void;
  read: () => { demo: DemoId; paused: boolean; bodies: number };
};
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function registerLabTools(actions: () => LabActions, context?: Context) {
  if (!context) return;
  const lifecycle = new AbortController();
  const tools: Tool[] = [
    {
      name: 'configure_physics_lab',
      description:
        'Select one of the six physics experiments and optionally pause or resume it. Selecting an experiment starts a fresh simulation.',
      inputSchema: {
        type: 'object',
        properties: {
          demo: { type: 'string', enum: demos.map((d) => d.id) },
          paused: { type: 'boolean' },
        },
        required: ['demo'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute(input) {
        const value = input as { demo?: unknown; paused?: unknown };
        if (
          !value ||
          !demos.some((d) => d.id === value.demo) ||
          (value.paused !== undefined && typeof value.paused !== 'boolean')
        )
          throw new Error(
            'Choose a valid experiment and a boolean paused value.',
          );
        actions().select(value.demo as DemoId);
        if (typeof value.paused === 'boolean') actions().pause(value.paused);
        return actions().read();
      },
    },
    {
      name: 'reset_physics_lab',
      description:
        'Reset the current experiment to its starting bodies and resume it.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute(input) {
        if (!input || typeof input !== 'object' || Object.keys(input).length)
          throw new Error('Reset expects an empty object.');
        actions().reset();
        return actions().read();
      },
    },
    {
      name: 'read_physics_lab',
      description:
        'Read the selected experiment, pause state and last sampled rigid-body count.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute() {
        return actions().read();
      },
    },
  ];
  for (const tool of tools)
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch((error) => console.warn('Lab tool registration failed', error));
    } catch (error) {
      console.warn('Lab tools unavailable', error);
    }
  return () => lifecycle.abort();
}
export function browserModelContext() {
  return (document as Document & { modelContext?: Context }).modelContext;
}
