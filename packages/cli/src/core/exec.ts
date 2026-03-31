import { execa } from "execa";

export type ExecOptions = {
  cwd: string;
  env?: Readonly<Partial<Record<string, string>>>;
};

export async function execCmd(cmd: string, args: string[], opts: ExecOptions) {
  const execaOpts = {
    cwd: opts.cwd,
    stdio: "inherit",
    ...(opts.env ? { env: opts.env } : {}),
  } as const;

  const child = execa(cmd, args, execaOpts);
  await child;
}

