const getAppSettings = async () => {
  const response = await fetch("./settings.json");
  return await response.json();
};

/**
 * ユーザーが入力した設定の取得
 * @returns
 */
const getUserSettings = () => {
  return {
    channnelName: document.getElementById("channel-name").value,
    aliases: document.getElementById("alias-names").value,
  };
};

/**
 * ツイッチのAPIまとめたやつ
 *
 * @param {*} appSettings
 * @param {*} userSettings
 * @param {*} authToken
 * @returns
 */
const twitchRepository = (appSettings, userSettings, authToken) => {
  /**
   * ユーザーのIDを取得する
   * @returns
   */
  const getBroadcasterId = async () => {
    const response = await fetch(`https://api.twitch.tv/helix/users?login=${userSettings.channnelName}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Client-Id": appSettings.twitch.clientId,
      },
    });
    const data = await response.json();
    console.debug(data);
    return data.data[0].id;
  };

  /**
   * サブスクライバーバッジの一覧を取得する
   * @param {*} broadcasterId
   * @returns
   */
  const listBadges = async (broadcasterId) => {
    const response = await fetch(`https://api.twitch.tv/helix/chat/badges?broadcaster_id=${broadcasterId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Client-Id": appSettings.twitch.clientId,
      },
    });
    const data = await response.json();
    console.debug(data);

    let badges = {};
    data.data.forEach((badge) => {
      const key = badge["set_id"];
      if (badges[key] === undefined) {
        badges[key] = {};
      }

      badge.versions.forEach((v) => {
        badges[key][v.id] = v["image_url_1x"];
      });
    });

    console.log(badges);

    return badges;
  };

  return {
    getBroadcasterId,
    listBadges,
  };
};

/**
 * 匿名の名前管理するやつ
 *
 * @param {*} userSettings
 * @returns
 */
const aliasRepository = (userSettings) => {
  const aliasMaster = userSettings.aliases
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  const aliasesByUserId = {};

  const numUsersByAlias = {};
  aliasMaster.forEach((a) => (numUsersByAlias[a] = 1));

  return {
    alias: (userId) => {
      if (!(userId in aliasesByUserId)) {
        const alias = aliasMaster[Math.floor(Math.random() * aliasMaster.length)];
        aliasesByUserId[userId] = alias + numUsersByAlias[alias];
        numUsersByAlias[alias]++;
      }

      return aliasesByUserId[userId];
    },
  };
};

/**
 * チャット取得するやつ
 *
 * @param {*} userSettings
 * @param {*} aliasRepo
 * @param {*} badges
 * @returns
 */
const ircFactory = (userSettings, aliasRepo, badges) => {
  const chatBody = document.getElementById("chat-body");
  const tmiClient = new tmi.Client({
    channels: [userSettings.channnelName],
  });

  const start = () => {
    tmiClient.connect().catch(console.error);

    tmiClient.on("message", (channel, tags, message, self) => {
      // チャットが来た

      const chat = {
        alias: aliasRepo.alias(tags["user-id"]),
        name: tags["display-name"],
        message: message,
        badgeUrls: [],
        time: new Date(Number(tags["tmi-sent-ts"])),
      };
      console.log(`${chat.alias} (${chat.name}): ${chat.message}`);
      console.log(tags);

      if (tags.badges) {
        chat.badgeUrls = Object.keys(tags.badges)
          .map((key) => badges[key]?.[tags.badges[key]])
          .filter((x) => x);
      }

      const chatDivTag = document.createElement("div");
      chatDivTag.className = "chat-line";

      const timeSpan = document.createElement("span");
      timeSpan.className = "time";
      timeSpan.appendChild(
        document.createTextNode(`${chat.time.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`)
      );
      chatDivTag.appendChild(timeSpan);

      chat.badgeUrls.forEach((badgeUrl) => {
        const badgeImgTag = document.createElement("img");
        badgeImgTag.className = "badge";
        badgeImgTag.src = badgeUrl;
        chatDivTag.appendChild(badgeImgTag);
      });

      const nameSpan = document.createElement("span");
      nameSpan.className = "name";
      nameSpan.appendChild(document.createTextNode(`${chat.alias}: `));
      chatDivTag.appendChild(nameSpan);

      const messageSpan = document.createElement("span");
      messageSpan.className = "message";
      messageSpan.appendChild(document.createTextNode(`${chat.message}`));
      chatDivTag.appendChild(messageSpan);

      chatBody.appendChild(chatDivTag);
      chatBody.scrollTop = chatBody.scrollHeight;
    });
  };

  const stop = () => {
    tmiClient.disconnect();
  };

  return {
    start,
    stop,
  };
};

const startChat = async (appSettings, authToken) => {
  const userSettings = getUserSettings();
  const aliasRepo = aliasRepository(userSettings);
  const twitch = twitchRepository(appSettings, userSettings, authToken);

  const broadcasterId = await twitch.getBroadcasterId();
  const badges = await twitch.listBadges(broadcasterId);

  const irc = ircFactory(userSettings, aliasRepo, badges);
  irc.start();

  return irc;
};

const main = async () => {
  const appSettings = await getAppSettings();
  const hasAuthToken = location.hash.slice(1).startsWith("access_token=");
  if (hasAuthToken) {
    // ツイッチ認証済み

    document.getElementById("no-connect").style = "display:none";
    document.getElementById("connected").style = "display:block";

    const authToken = location.hash.slice(1).split("&")[0].replace("access_token=", "");
    const startButton = document.getElementById("start-button");
    let chat = null;
    startButton.onclick = async () => {
      startButton.disabled = true;
      stopButton.disabled = false;
      chat = await startChat(appSettings, authToken);
    };

    const stopButton = document.getElementById("stop-button");
    stopButton.disabled = true;
    stopButton.onclick = () => {
      startButton.disabled = false;
      stopButton.disabled = true;
      if (chat !== null) {
        chat.stop();
        chat = null;
      }
    };

    const logoutTwitchButton = document.getElementById("logout-twitch");
    const aTag = document.createElement("a");
    aTag.href = appSettings.twitch.redirectUrl;
    aTag.appendChild(document.createTextNode("ログアウト"));
    logoutTwitchButton.appendChild(aTag);
  } else {
    // ツイッチ認証前

    document.getElementById("no-connect").style = "display:block";
    document.getElementById("connected").style = "display:none";

    const connectTwitchButton = document.getElementById("connect-twitch");
    const aTag = document.createElement("a");
    aTag.href = `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${appSettings.twitch.clientId}&redirect_uri=${appSettings.twitch.redirectUrl}&scope=&state=c3ab8aa609ea11e793ae92361f002612`;
    aTag.appendChild(document.createTextNode("Twitch連携"));
    connectTwitchButton.appendChild(aTag);
  }
};

document.addEventListener("DOMContentLoaded", main);
