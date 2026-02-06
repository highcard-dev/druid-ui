/// <reference types="@druid-ui/component/types" />
/// <reference types="@druid-ui/component/jsx" />
/** @jsx d */
import { Context, d, Event, log, createComponent } from "@druid-ui/component";
import {
  request,
  loadFileFromDeployment,
  saveFileToDeployment,
} from "@druid-ui/plattform";

let i = 0;
const config: Record<string, unknown> = {};

const CONFIG_FILENAME = "server.properties.scroll_template";

const saveCurrentConfig = () => {
  const serializedConfig = Object.entries(config)
    .map((line) => line.join("="))
    .join("\n");
  saveFileToDeployment(CONFIG_FILENAME, serializedConfig);
  log(serializedConfig);
};

interface ComponentTitle {
  property: string;
  value: string;
}

const MainComponent = {
  init: async () => {
    log("hallo");
    try {
      const data = (await loadFileFromDeployment(CONFIG_FILENAME)) as string;
      log("test");
      log(data);
      const content = data.split("\n");
      for (const line of content) {
        const parsedLine = line.split("=");
        if (parsedLine.length < 2) {
          continue;
        }
        const [property, value] = parsedLine;
        config[property] = value;
      }
    } catch (e) {
      log(e);
    }
  },
  view: () => {
    log("render main component");
    return (
      <div>
        {Object.entries(config).map(([property, value]) => {
          return <ComponentTitle property={property} value={value} />;
        })}
      </div>
    );
  },
};

const ComponentTitle = {
  view: ({ property, value }) => (
    <div>
      <label>
        {property}
        <input
          type="text"
          value={value}
          onInput={(e) => {
            config[property] = e.value();
          }}
        />
      </label>
    </div>
  ),
};

export const component = createComponent((ctx: Context) => {
  log(`Init called with path: ${ctx.path}`);

  log(JSON.stringify(config));
  if (ctx.path == "/test") {
    return (
      <div>
        <a href="/">go back</a>
        Hallo Marc
      </div>
    );
  }
  return (
    <div>
      <div>
        <MainComponent />
      </div>
      <main>
        <button
          onClick={async (e) => {
            const data = (await loadFileFromDeployment(
              CONFIG_FILENAME
            )) as string;
            log("test");
            log(data);
            //saveCurrentConfig();
          }}
        >
          Do click123
        </button>
        <hr />
        <b>Clicks: </b> {i}
        {i > 5 ? <div>more than 6 clicks!</div> : ""}
      </main>
      <a href="/test">go to test page</a>
    </div>
  );
});
