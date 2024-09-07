const fs = require("fs");
const axios = require("axios");
const colors = require("colors");
const { DateTime } = require("luxon");

class Major {
  constructor() {
    this.baseUrl = "https://major.glados.app/api";
    this.endpoints = {
      auth: `${this.baseUrl}/auth/tg/`,
      userInfo: `${this.baseUrl}/users/`,
      streak: `${this.baseUrl}/user-visits/streak/`,
      visit: `${this.baseUrl}/user-visits/visit/`,
      roulette: `${this.baseUrl}/roulette/`,
      holdCoins: `${this.baseUrl}/bonuses/coins/`,
      tasks: `${this.baseUrl}/tasks/`,
      swipeCoin: `${this.baseUrl}/swipe_coin/`,
    };
    this.totalBalance = 0;
  }

  headers(token = null) {
    const headers = {
      Accept: "application/json, text/plain, */*",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "en-US,en;q=0.6",
      "Content-Type": "application/json",
      Origin: "https://major.glados.app/reward",
      Referer: "https://major.glados.app/",
      "Sec-Ch-Ua":
        '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  log(msg, type = "info") {
    const colorMap = {
      acc: colors.cyan,
      info: colors.bold.blue,
      success: colors.bold.green,
      warning: colors.bold.yellow,
      error: colors.bold.red,
    };
    console.log(colorMap[type](msg));
  }

  async waitWithCountdown(seconds) {
    for (let i = seconds; i >= 0; i--) {
      const hours = Math.floor(i / 3600);
      const minutes = Math.floor((i % 3600) / 60);
      const secs = i % 60;
      process.stdout.write(
        `\rWaiting ${hours}h:${minutes}m:${secs}s to continue...`
      );
      await this.sleep(1000);
    }
    process.stdout.write("\r" + " ".repeat(60) + "\r");
  }

  async apiRequest(method, url, data = null, token = null) {
    try {
      const config = {
        method,
        url,
        headers: this.headers(token),
        ...(data && { data }),
      };
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response && error.response.data) {
        return error.response.data;
      }
      this.log(`Error in API request: ${error.message}`, "error");
      return null;
    }
  }

  async authenticate(init_data) {
    const result = await this.apiRequest("post", this.endpoints.auth, {
      init_data,
    });
    if (!result) {
      this.log("Error during authentication", "error");
    }
    return result;
  }

  async getUserInfo(userId, token) {
    const result = await this.apiRequest(
      "get",
      `${this.endpoints.userInfo}${userId}/`,
      null,
      token
    );
    if (result) {
      this.totalBalance += result.rating;
    }
    return result;
  }

  async getStreak(token) {
    return await this.apiRequest("get", this.endpoints.streak, null, token);
  }

  async postVisit(token) {
    return await this.apiRequest("post", this.endpoints.visit, {}, token);
  }

  async spinRoulette(token) {
    const result = await this.apiRequest(
      "post",
      this.endpoints.roulette,
      {},
      token
    );
    if (result && result.rating_award > 0) {
      this.totalBalance += result.rating_award;
    }
    return result;
  }

  async holdCoins(token) {
    const coins = Math.floor(Math.random() * (950 - 900 + 1)) + 900;
    return await this.apiRequest(
      "post",
      this.endpoints.holdCoins,
      { coins },
      token
    );
  }

  async swipeCoin(token) {
    const getResult = await this.apiRequest(
      "get",
      this.endpoints.swipeCoin,
      null,
      token
    );
    if (getResult.success) {
      const coins = Math.floor(Math.random() * (1300 - 1000 + 1)) + 1000;
      return await this.apiRequest(
        "post",
        this.endpoints.swipeCoin,
        { coins },
        token
      );
    }
    return null;
  }

  async getDailyTasks(token) {
    return await this.apiRequest(
      "get",
      `${this.endpoints.tasks}?is_daily=false`,
      null,
      token
    );
  }

  async completeTask(token, task) {
    return await this.apiRequest(
      "post",
      this.endpoints.tasks,
      { task_id: task.id },
      token
    );
  }

  formatBlockedTime(timestamp) {
    return DateTime.fromSeconds(timestamp)
      .setZone("system")
      .toLocaleString(DateTime.DATETIME_MED);
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async processAccount(init_data, accountIndex) {
    const authResult = await this.authenticate(init_data);
    if (!authResult || !authResult.access_token || !authResult.user) {
      this.log(
        `Unable to authenticate account ${
          accountIndex + 1
        }. Auth result: ${JSON.stringify(authResult)}`,
        "error"
      );
      return;
    }

    const { access_token, user } = authResult;
    if (!user.id || !user.first_name) {
      this.log(
        `Invalid user data for account ${
          accountIndex + 1
        }. User data: ${JSON.stringify(user)}`,
        "error"
      );
      return;
    }

    const { id, first_name } = user;

    this.log(`\n[ Account ${accountIndex + 1} | ${first_name} ]`, "acc");

    try {
      const userInfo = await this.getUserInfo(id, access_token);
      if (!userInfo) {
        throw new Error("Failed to get user info");
      }

      const streakInfo = await this.getStreak(access_token);
      const visitResult = await this.postVisit(access_token);
      const rouletteResult = await this.spinRoulette(access_token);
      const holdCoinsResult = await this.holdCoins(access_token);
      const swipeCoinResult = await this.swipeCoin(access_token);

      this.log(`Stars: ${userInfo.rating}`, "info");
      this.log(
        `Streak: ${streakInfo ? streakInfo.streak : "N/A"} days`,
        "info"
      );

      if (visitResult && visitResult.is_increased) {
        this.log(`Check-in: Success (Day ${visitResult.streak})`, "success");
      } else if (visitResult) {
        this.log(
          `Check-in: Already done (Day ${visitResult.streak})`,
          "warning"
        );
      } else {
        this.log("Check-in: Failed", "error");
      }

      if (rouletteResult && rouletteResult.rating_award > 0) {
        this.log(`Roulette: +${rouletteResult.rating_award} stars`, "success");
      } else if (
        rouletteResult &&
        rouletteResult.detail &&
        rouletteResult.detail.blocked_until
      ) {
        this.log(
          `Roulette: Blocked until ${this.formatBlockedTime(
            rouletteResult.detail.blocked_until
          )}`,
          "warning"
        );
      } else {
        this.log("Roulette: Failed", "error");
      }

      if (holdCoinsResult && holdCoinsResult.success) {
        this.log(`Hold Coins: Success`, "success");
      } else if (
        holdCoinsResult &&
        holdCoinsResult.detail &&
        holdCoinsResult.detail.blocked_until
      ) {
        this.log(
          `Hold Coins: Blocked until ${this.formatBlockedTime(
            holdCoinsResult.detail.blocked_until
          )}`,
          "warning"
        );
      } else {
        this.log("Hold Coins: Failed", "error");
      }

      if (swipeCoinResult && swipeCoinResult.success) {
        this.log(`Swipe Coin: Success`, "success");
      } else if (
        swipeCoinResult &&
        swipeCoinResult.detail &&
        swipeCoinResult.detail.blocked_until
      ) {
        this.log(
          `Swipe Coin: Blocked until ${this.formatBlockedTime(
            swipeCoinResult.detail.blocked_until
          )}`,
          "warning"
        );
      } else {
        this.log("Swipe Coin: Failed", "error");
      }

      const tasks = await this.getDailyTasks(access_token);
      if (tasks) {
        let completedTasks = 0;
        for (const task of tasks) {
          const result = await this.completeTask(access_token, task);
          if (result && result.is_completed) {
            completedTasks++;
          }
          await this.sleep(1000);
        }
        this.log(`Tasks: Completed ${completedTasks}/${tasks.length}`, "info");
      } else {
        this.log("Tasks: Failed to retrieve", "error");
      }

      // Get updated user info to ensure we have the latest balance
      await this.getUserInfo(id, access_token);
    } catch (error) {
      this.log(
        `Error processing account ${accountIndex + 1}: ${error.message}`,
        "error"
      );
    }
  }

  async main() {
    const dataFile = "data.txt";
    const data = fs.readFileSync(dataFile, "utf8").split("\n").filter(Boolean);

    while (true) {
      this.totalBalance = 0;
      for (let i = 0; i < data.length; i++) {
        const init_data = data[i].trim();
        await this.processAccount(init_data, i);

        if (i < data.length - 1) {
          await this.waitWithCountdown(3);
        }
      }

      this.log(
        `\nTotal balance for all accounts: ${this.totalBalance} stars`,
        "success"
      );

      await this.waitWithCountdown(28850);
    }
  }
}

if (require.main === module) {
  const major = new Major();
  major.main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}