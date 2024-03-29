import puppeteer from "puppeteer";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
const __dirname = path.resolve();

async function main() {
  let done = false;
  let cnt = 1;

  const url = "https://fastcampusbootcamp.skillflo.io/auth/signin";
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--disable-web-security", "--disable-features=IsolateOrigins,site-per-process"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(url, {
    waitUntil: "networkidle2",
  });

  page.on("dialog", async (dialog) => {
    console.log("dialog message: ", dialog.message());
    await dialog.accept();
  });

  console.log("30초 후에 크롤링 시작합니다. 귀찮으니까 직접 로그인합니다.");
  setInterval(() => {});
  await new Promise((r) => setTimeout(r, 30000));

  let currentpageUrl = page.url();
  while (!done) {
    try {
      const frameSrc = await page.evaluate(() => {
        const iframe = document.querySelector(
          "#app > section > div > section > div.css-1f21t3v.eeu549n0 > div > iframe"
        ) as HTMLIFrameElement;
        return !iframe ? null : iframe.src;
      });

      if (!frameSrc) await handleException(currentpageUrl, "frameSrc is null");

      const iframePage = await browser.newPage();
      await iframePage.goto(frameSrc!, {
        waitUntil: "networkidle2",
      });

      const videoSrc = await iframePage.evaluate(() => {
        const videoEl = document.querySelector("#kollus_player_html5_api") as HTMLVideoElement;
        return !videoEl ? null : videoEl.src;
      });
      let title = await page.evaluate(() => {
        return document.querySelector("#app > section > div > footer > div.css-pl04xr.edl2vfq1")?.textContent || null;
      });
      if (!videoSrc) await handleException(currentpageUrl, "videoSrc is null");
      if (!title) {
        await recordError(currentpageUrl, "title is null");
        title = "no title_";
      }

      await downloadVideo(videoSrc!, path.join(__dirname, `${title! + "_" + Date.now()}.mp4`));
      iframePage.close();

      // 다음 페이지로 이동
      const a = currentpageUrl.split("/");
      const nextUrl = a
        .map((v, idx) => {
          if (a.length - 1 === idx) return parseInt(v) + 1;
          return v;
        })
        .join("/");
      currentpageUrl = nextUrl;
      await page.goto(nextUrl, {
        waitUntil: "networkidle2",
      });
    } catch (e) {
      handleException(currentpageUrl, e);
      done = true;
    }
  }
}

main();

const handleException = async (url: string, message: any) => {
  await new Promise((res) => {
    fs.readFile(path.join(__dirname, "error.txt"), (err, data) => {
      if (err) {
        console.error(`not found ${path.join(__dirname, "error.txt")} file, create new file.`);
        fs.writeFileSync(path.join(__dirname, "error.txt"), `[${new Date()}] [${url}] ${message}\n`);
      } else {
        fs.appendFileSync(path.join(__dirname, "error.txt"), `[${new Date()}] [${url}] ${message}\n`);
      }
      res(true);
    });
  });
  throw new Error(`ERROR : [${url}] ${message}`);
};

const recordError = async (url: string, message: any) => {
  await new Promise((res) => {
    fs.readFile(path.join(__dirname, "error.txt"), (err, data) => {
      if (err) {
        console.error(`not found ${path.join(__dirname, "error.txt")} file, create new file.`);
        fs.writeFileSync(path.join(__dirname, "error.txt"), `[${new Date()}] [${url}] ${message}\n`);
      } else {
        fs.appendFileSync(path.join(__dirname, "error.txt"), `[${new Date()}] [${url}] ${message}\n`);
      }
      res(true);
    });
  });
};

const downloadVideo = async (url: string, savePath: string) => {
  try {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(savePath);

      https
        .get(url, (response) => {
          response.pipe(file);
          file.on("finish", () => {
            file.close(resolve); // close() is async, resolve after close completes.
          });
        })
        .on("error", (err: any) => {
          // Handle errors
          fs.unlink(savePath, () => {}); // Delete the file async. (But we don't check the result)
          reject(err.message);
        });
    });
  } catch (err) {
    handleException(url, err);
  }
};
