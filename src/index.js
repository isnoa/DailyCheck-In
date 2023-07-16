console.clear();
require("dotenv").config();

const axios = require('axios');
const moment = require('moment');
const cron = require('node-cron');
const uuid = require("uuid");
const crypto = require('node:crypto');

const { env } = require('process');
const zzz = require("./zzz");


// config
const config = {
  genshinSignURI: "https://sg-hk4e-api.hoyolab.com/event/sol/sign?act_id=e202102251931481&lang=ko-kr",
  delay: 1300,
  webhookPost: true,
  webhookWarningURI: env.WEBHOOKWARNING,
  webhookNoticeURI: env.WEBHOOKNOTICE,
};

console.log(`[${getDate()}] Program is ready! Please wait until next 0:00 (UTC +8)`);

async function dailyCheckIn() {

  let signCookie = await zzz.findAll({ where: { is_authorized: true } })
    .then(users => {
      const cookies = users.map(user => {
        const encryptedCookie = Buffer.from(user.authcookie, 'base64');
        const decipher = crypto.createDecipheriv(env.CRYPTO_ALGORITHM, env.CRYPTO_KEY, env.CRYPTO_IV);
        let decrypted = decipher.update(encryptedCookie, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      });

      return cookies;
    })
    .catch(error => {
      console.error('Error:', error);
    });

  const invalidJobs = [];
  const succeedJobs = [];
  const alreadyJobs = [];
  const failedJobs = [];

  console.log(`[${getDate()}] Preparing auto DAILY CHECK-IN for ${signCookie.length} users..`);

  for (const jobCookie of signCookie) {
    const instance = axios.create({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.72 Safari/537.36',
        Cookie: jobCookie,
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json;charset=utf-8',
        Referrer: 'https://act.hoyolab.com/',
        'x-rpc-challenge': uuid.v3(jobCookie ?? '', uuid.v3.URL).replace('-', '')
      },
    });

    const accountID = parseCookie(jobCookie).ltuid;

    await waitFor(config.delay);

    console.log(`[${getDate()}] Starting DAILY CHECK-IN for accountID: ${accountID}`);

    if (!isValidCookie(jobCookie)) {
      const encryptedCookie = createCipheriv(jobCookie)
      const zzzData = zzz.findOne({ where: { authcookie: encryptedCookie } })

      console.log(`[${getDate()}] ERROR! Invalid cookie format detected for ${accountID}!`);
      invalidJobs.push(zzzData.user_id);
    } else {
      const chkInResult = await instance.post(config.genshinSignURI);

      if (chkInResult.data.retcode == '-5003') {
        console.log(`[${getDate()}] ERROR! Failed to DAILY CHECK-IN for accountID: ${accountID}`);
        console.log(`[${getDate()}] Reason: ${chkInResult.data?.message ?? 'Unknown'}`);
        alreadyJobs.push(accountID);
      } else if (
        chkInResult.status !== 200 ||
        chkInResult.data.retcode !== 0 ||
        chkInResult.data.data?.code !== 'ok' ||
        chkInResult.data.data?.is_risk !== false
      ) {
        console.log(`[${getDate()}] ERROR! Failed to DAILY CHECK-IN for accountID: ${accountID}`);
        console.log(`[${getDate()}] Reason: ${chkInResult.data?.message ?? 'Unknown'}`);
        failedJobs.push(accountID);
      } else {
        console.log(`[${getDate()}] Succeed to DAILY CHECK-IN for accountID: ${accountID}!`);
        succeedJobs.push(accountID);
      }
    }
  }

  console.log(`[${getDate()}] DAILY CHECK-IN completed! fetching result..`);

  const invalidResult = invalidJobs.length > 0 ? `${succeedJobs.length} 명` : '없음';
  const succeedResult = succeedJobs.length > 0 ? `${succeedJobs.length} 명` : '없음';
  const alreadyResult = alreadyJobs.length > 0 ? `${alreadyJobs.length} 명` : '없음';
  const failedResult = failedJobs.length > 0 ? `${failedJobs.length} 명` : '없음';

  console.log([
    '===================================',
    `[${getDate()}] Invalid: ${invalidResult.replaceAll('`', '')}`,
    `[${getDate()}] Succeed: ${succeedResult.replaceAll('`', '')}`,
    `[${getDate()}] Already: ${alreadyResult.replaceAll('`', '')}`,
    `[${getDate()}] Failed: ${failedResult.replaceAll('`', '')}`,
    '===================================',
  ].join('\n'));

  if (invalidJobs.length > 0) {
    webhookWarning(invalidJobs);
  }

  webhookNotice(signCookie, succeedResult, alreadyResult, failedResult);
}
// dailyCheckIn()
cron.schedule('0 0 * * *', dailyCheckIn, {
  scheduled: true,
  timezone: 'Asia/Shanghai',
});

function isValidCookie(cookies) {
  if (typeof cookies !== 'string') return undefined;
  const output = parseCookie(cookies);
  const requiredFields = ['ltuid', 'ltuid'];
  return requiredFields
    .map((field) => Object.keys(output).includes(field))
    .every((element) => !!element);
}

function parseCookie(cookies) {
  const output = {};
  cookies.split(/\s*;\s*/).forEach((pair) => {
    pair = pair.split(/\s*=\s*/);
    output[pair[0]] = pair.splice(1).join('=');
  });
  return output;
}

function createCipheriv(jobCookie) {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encryptedCookie = cipher.update(jobCookie, 'utf8', 'base64');
  encryptedCookie += cipher.final('base64');
  return encryptedCookie;
}

async function webhookWarning(invalidJobs) {
  if (config.webhookPost) {
    const mentionedInvalidJobs = invalidJobs.map(id => `<@${id}>`);
    const body = JSON.stringify({
      embeds: [
        {
          title: "WARNING",
          description: `${mentionedInvalidJobs.join(', ')}, 출석 체크 기능으로 쿠키가 올바른가 확인하는 과정에서 쿠키가 유효하지 않음을 발견했습니다.\n해당 기능을 포함한 미야비의 기능을 사용하시려면 탈퇴 후에 다시 가입을 해주셔야 합니다.`,
          color: 0x000000,
          footer: {
            text: "- 개발자가 정보를 확인해본게 아닌 자동으로 확인된 것 입니다."
          },
          timestamp: new Date(),
        }
      ],
    });
    return await axios.post(config.webhookWarningURI, body, {
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
      },
    });
  }
}

async function webhookNotice(signCookie, succeedResult, alreadyResult, failedResult) {
  if (config.webhookPost) {
    const body = JSON.stringify({
      embeds: [
        {
          title: "선생. 에? 여기가 아닌가.. 뭐, 아무튼 출석체크 해놨어..",
          description: `> **출석체크를 사용하는 로프꾼 \` ${signCookie.length} \`명의 출석체크 현황.**\n> **성공함:  \` ${succeedResult} \`**\n> **이미함:  \` ${alreadyResult} \`**\n> **실패함:  \` ${failedResult} \`**`,
          color: 0x313157,
          footer: {
            text: "엣? 센세. 난 미야비가 아니야.. 후부키야! 후.부.키!!"
          },
          timestamp: new Date(),
        }
      ],
    });
    return await axios.post(config.webhookNoticeURI, body, {
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
      },
    })
  }
}

async function waitFor(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

function getDate() {
  return moment().format('YYYY-MM-DD HH:mm:ss');
}