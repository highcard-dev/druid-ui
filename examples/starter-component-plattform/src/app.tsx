import { type Context, createComponent } from "@druid-ui/component";
import {
  request,
  loadFileFromDeployment,
  saveFileToDeployment,
} from "@druid-ui/plattform";

const file = "hello-druid-ui.txt";
let fileOut = "";
let httpOut = "";
let err = "";

async function safe(run: () => Promise<void>) {
  err = "";
  try {
    await run();
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
}

export const component = createComponent((ctx: Context) => (
  <div>
    <p>
      <button
        onClick={() =>
          safe(async () => {
            await saveFileToDeployment(file, "Hello from Druid UI!\n");
            fileOut = "(written)";
          })
        }
      >
        write file
      </button>{" "}
      <button
        onClick={() =>
          safe(async () => {
            fileOut = (await loadFileFromDeployment(file)) as string;
          })
        }
      >
        read file
      </button>{" "}
      <button
        onClick={() =>
          safe(async () => {
            httpOut = (await request(
              "https://jsonplaceholder.typicode.com/todos/1",
              "GET",
              "",
              [],
            )) as string;
          })
        }
      >
        fetch
      </button>
    </p>
    <pre>{`file: ${fileOut || "—"}\nhttp: ${httpOut || "—"}\nerr: ${
      err || "—"
    }`}</pre>
  </div>
));
