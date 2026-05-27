import chalk from "chalk";

export const ui = {
  header() {
    console.log(chalk.bold.cyan("\n  ██████╗  ██████╗  ██████╗ ██████╗ ███████╗"));
    console.log(chalk.bold.cyan("  ██╔═══██╗██╔═══██╗██╔═══██╗██╔══██╗██╔════╝"));
    console.log(chalk.bold.cyan("  ██║   ██║██║   ██║██║   ██║██║  ██║█████╗  "));
    console.log(chalk.bold.cyan("  ██║▄▄ ██║██║▄▄ ██║██║   ██║██║  ██║██╔══╝  "));
    console.log(chalk.bold.cyan("  ╚██████╔╝╚██████╔╝╚██████╔╝██████╔╝███████╗"));
    console.log(chalk.bold.cyan("   ╚══▀▀═╝  ╚══▀▀═╝  ╚═════╝ ╚═════╝ ╚══════╝"));
    console.log(chalk.dim("  Qwen Qode — coding agent powered by Qwen2.5-coder\n"));
  },

  prompt(cwd: string) {
    const short = cwd.replace(process.env.HOME ?? "", "~");
    process.stdout.write(chalk.green(`\n[${short}] `) + chalk.bold.white("» "));
  },

  thinking() {
    process.stdout.write(chalk.dim("\n  Thinking…"));
  },

  clearLine() {
    process.stdout.write("\r\x1b[K");
  },

  assistantStart() {
    process.stdout.write(chalk.bold.cyan("\n  Qwen Qode\n"));
  },

  assistantText(text: string) {
    const indented = text
      .split("\n")
      .map((l) => "  " + l)
      .join("\n");
    console.log(chalk.white(indented));
  },

  toolCall(name: string, args: Record<string, unknown>) {
    const preview = JSON.stringify(args).slice(0, 120);
    console.log(chalk.dim(`\n  ⚙  ${chalk.yellow(name)} ${chalk.dim(preview)}`));
  },

  toolResult(name: string, success: boolean, output: string) {
    const icon = success ? chalk.green("✓") : chalk.red("✗");
    const lines = output.split("\n").slice(0, 20);
    const truncated = lines.length < output.split("\n").length;
    const preview = lines.join("\n");
    console.log(chalk.dim(`     ${icon} ${name}:`));
    if (preview.trim()) {
      console.log(
        chalk.dim(
          preview
            .split("\n")
            .map((l) => "       " + l)
            .join("\n")
        )
      );
    }
    if (truncated) {
      console.log(chalk.dim("       … (output truncated)"));
    }
  },

  error(msg: string) {
    console.error(chalk.red(`\n  Error: ${msg}`));
  },

  info(msg: string) {
    console.log(chalk.dim(`  ${msg}`));
  },

  separator() {
    console.log(chalk.dim("  " + "─".repeat(60)));
  },
};
