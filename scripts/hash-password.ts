/**
 * `pnpm hash-password [password]` — prints ONLY the bcrypt hash (cost 12). With no argument it asks on
 * the terminal (input is hidden). The plaintext is never written anywhere.
 * Put the result in .env.local as APP_PASSWORD_HASH='<hash>' (single quotes: "$" is special in dotenv).
 */
import bcrypt from "bcryptjs";

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    let value = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") process.exit(130); // Ctrl+C
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const arg = process.argv[2];
  const password = arg ?? (await promptHidden("Password (min 10 characters): "));
  if (password.length < 10) {
    console.error("Use at least 10 characters.");
    process.exit(1);
  }
  process.stdout.write(`${await bcrypt.hash(password, 12)}\n`);
}

void main();
