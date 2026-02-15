import { test, expect } from "@playwright/test";

const quizExportPayload = {
  quiz_id: 33,
  title: "E2E Quiz",
  access_code: "E2E33",
  background: { color: "#1e1e2e", image: "", text_color: "#ffffff" },
  music_url: "",
  text_color: "#ffffff",
  slides: [
    {
      slide_id: 101,
      slide_type: 1,
      order: 1,
      show_leaderboard_after: true,
      leaderboard: [],
      question: {
        question_id: 101,
        text: "What is 2 + 2?",
        title: "Q1",
        time_limit: 30,
        max_point: 100,
        min_point: 10,
        access_code: "E2E33",
        question_type: "single",
        image_url: "",
        faster_answers_more_points: true,
        partial_scoring: false,
        options: [
          { option_id: 1, text: "3", is_correct: false, votes: 0, image_url: "", order: 1 },
          { option_id: 2, text: "4", is_correct: true, votes: 0, image_url: "", order: 2 },
        ],
      },
    },
    {
      slide_id: 102,
      slide_type: 3,
      order: 1,
      title: "Leaderboard",
      leaderboard: [],
    },
    {
      slide_id: 103,
      slide_type: 2,
      order: 2,
      title: "Content",
      content_text: "Content slide",
      content_image_url: "",
      leaderboard: [],
    },
  ],
};

const quizExportPayloadLeaderboardAsType2 = {
  quiz_id: 33,
  title: "E2E Quiz Type2 Leaderboard",
  access_code: "E2E33",
  background: { color: "#1e1e2e", image: "", text_color: "#ffffff" },
  music_url: "",
  text_color: "#ffffff",
  slides: [
    {
      slide_id: 201,
      slide_type: 1,
      order: 1,
      show_leaderboard_after: true,
      leaderboard: [],
      question: {
        question_id: 201,
        text: "Q1",
        title: "Q1",
        time_limit: 30,
        max_point: 100,
        min_point: 10,
        access_code: "E2E33",
        question_type: "single",
        image_url: "",
        faster_answers_more_points: true,
        partial_scoring: false,
        options: [
          { option_id: 11, text: "A", is_correct: true, votes: 0, image_url: "", order: 1 },
          { option_id: 12, text: "B", is_correct: false, votes: 0, image_url: "", order: 2 },
        ],
      },
    },
    {
      slide_id: 202,
      slide_type: 2,
      order: 1,
      title: "",
      content_text: "",
      content_image_url: "",
      leaderboard: [],
    },
    {
      slide_id: 203,
      slide_type: 1,
      order: 2,
      show_leaderboard_after: true,
      leaderboard: [],
      question: {
        question_id: 203,
        text: "Q2",
        title: "Q2",
        time_limit: 30,
        max_point: 100,
        min_point: 10,
        access_code: "E2E33",
        question_type: "single",
        image_url: "",
        faster_answers_more_points: true,
        partial_scoring: false,
        options: [
          { option_id: 21, text: "A", is_correct: true, votes: 0, image_url: "", order: 1 },
          { option_id: 22, text: "B", is_correct: false, votes: 0, image_url: "", order: 2 },
        ],
      },
    },
    {
      slide_id: 204,
      slide_type: 2,
      order: 2,
      title: "",
      content_text: "",
      content_image_url: "",
      leaderboard: [],
    },
  ],
};

const questionMessage = {
  type: 2,
  question_id: 101,
  run_id: 9001,
  question_text: "What is 2 + 2?",
  question_time: 30,
  remaining_seconds: 22,
  started_at: Math.floor(Date.now() / 1000) - 8,
  options: [
    { option_id: 1, option_text: "3", answer: false, number_of_submits: 0 },
    { option_id: 2, option_text: "4", answer: true, number_of_submits: 0 },
  ],
};

const question2Message = {
  ...questionMessage,
  question_id: 203,
  question_text: "Q2",
};

const contentMessageType2 = {
  type: 2,
  slide_type: 2,
  slide_id: 103,
  title: "Content Live",
  content_text: "Runtime content from WS",
  content_image_url: "",
};

const leaderboardMessage = {
  type: 1,
  results: [
    { user_id: "u1", name: "ali", character: "A", total_points: 50, new_points: 50, rank: 1 },
  ],
};

async function mockQuizExport(page, payload = quizExportPayload) {
  await page.route("**/quizzes/33/export/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
}

async function installMockWebSocket(page, scenario) {
  await page.addInitScript((rawScenario) => {
    const scenario = rawScenario || {};

    const parseJson = (data) => {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    };

    class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.CONNECTING;
        this.onopen = null;
        this.onclose = null;
        this.onmessage = null;
        this.onerror = null;

        const roleMatch = /\/ws\/[^/]+\/([^/?#]+)/.exec(url);
        this.role = roleMatch ? roleMatch[1] : "unknown";

        const counterKey = `__mock_ws_count_${this.role}`;
        const nextCount = Number(localStorage.getItem(counterKey) || "0") + 1;
        localStorage.setItem(counterKey, String(nextCount));
        this.connectionIndex = nextCount;
        this.navigationStepByAction = {};
        this.joinStep = 0;

        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          this.onopen && this.onopen({ type: "open" });
          this._scheduleMessages();
        }, 20);
      }

      _emitMessage(payload) {
        if (this.readyState !== MockWebSocket.OPEN) return;
        if (payload == null) return;

        if (typeof payload === "string") {
          this.onmessage && this.onmessage({ data: payload, type: "message" });
          return;
        }

        this.onmessage &&
          this.onmessage({ data: JSON.stringify(payload), type: "message" });
      }

      _scheduleMessages() {
        const byRole = scenario[this.role] || {};
        const queue = this.connectionIndex === 1 ? byRole.first || [] : byRole.next || [];

        for (const item of queue) {
          const delay = Number(item?.delay ?? 0);
          const payload = item?.data;
          setTimeout(() => this._emitMessage(payload), delay);
        }
      }

      send(raw) {
        if (this.readyState !== MockWebSocket.OPEN) return;
        const msg = typeof raw === "string" ? parseJson(raw) : raw;
        if (!msg || typeof msg !== "object") return;

        const byRole = scenario[this.role] || {};
        if (msg.type === 6) {
          const joinQueue = byRole.join || [];
          const joinItem = joinQueue[this.joinStep];
          if (!joinItem) return;
          this.joinStep += 1;
          const joinDelay = Number(joinItem?.delay ?? 0);
          const joinPayload = joinItem?.data;
          setTimeout(() => this._emitMessage(joinPayload), joinDelay);
          return;
        }
        const nav = byRole.navigation || {};
        const navQueue = nav[msg.action] || [];
        const currentStep = Number(this.navigationStepByAction[msg.action] || 0);
        const item = navQueue[currentStep];
        if (!item) return;
        this.navigationStepByAction[msg.action] = currentStep + 1;
        const delay = Number(item?.delay ?? 0);
        const payload = item?.data;
        setTimeout(() => this._emitMessage(payload), delay);
      }

      close() {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose && this.onclose({ code: 1000, reason: "closed", type: "close" });
      }
    }

    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      writable: true,
      value: MockWebSocket,
    });
  }, scenario);
}

test("manager refresh during question does not flash join lobby and stays synced", async ({ page }) => {
  await mockQuizExport(page);

  await page.addInitScript(() => {
    const markerKey = "__manager_join_flash__";
    const watch = () => {
      try {
        const text = document?.body?.innerText || "";
        if (text.includes("Waiting for players to join...")) {
          sessionStorage.setItem(markerKey, "1");
        }
      } catch {
        // ignore
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });

  await installMockWebSocket(page, {
    manager: {
      first: [{ delay: 120, data: questionMessage }],
      next: [
        { delay: 80, data: { type: 7, users: [{ user_id: "u1", name: "ali", character: "A" }] } },
        { delay: 1000, data: { ...questionMessage, remaining_seconds: 18 } },
      ],
    },
  });

  await page.goto("/manager/presentation/33");
  await expect(page.getByText("What is 2 + 2?")).toBeVisible();

  await page.reload();
  await expect(page.getByText("What is 2 + 2?")).toBeVisible();

  const joinFlash = await page.evaluate(() => sessionStorage.getItem("__manager_join_flash__"));
  expect(joinFlash).not.toBe("1");
});

test("manager leaderboard slide number stays aligned with leaderboard slide", async ({ page }) => {
  await mockQuizExport(page);
  await installMockWebSocket(page, {
    manager: {
      first: [
        { delay: 100, data: questionMessage },
        {
          delay: 700,
          data: {
            type: 1,
            results: [
              { user_id: "u1", name: "ali", character: "A", total_points: 50, new_points: 50, rank: 1 },
            ],
          },
        },
      ],
    },
  });

  await page.goto("/manager/presentation/33");
  await expect(page.getByText("Leaderboard")).toBeVisible();
  await expect(page.getByText(/\b2\s*\/\s*3\b/)).toBeVisible();
});

test("manager slide number increments immediately on next when next slide is leaderboard", async ({ page }) => {
  await mockQuizExport(page);
  await installMockWebSocket(page, {
    manager: {
      first: [{ delay: 100, data: questionMessage }],
      navigation: {
        next: [{ delay: 900, data: leaderboardMessage }],
      },
    },
  });

  await page.goto("/manager/presentation/33");
  await expect(page.getByText("What is 2 + 2?")).toBeVisible();
  await expect(page.getByText(/\b1\s*\/\s*3\b/)).toBeVisible();

  await page.getByRole("button", { name: /next|بعدی|اسلاید بعدی/i }).click();

  // Before server emits leaderboard, UI should already show 2/3.
  await page.waitForTimeout(250);
  await expect(page.getByText(/\b2\s*\/\s*3\b/)).toBeVisible();

  // After server emits leaderboard, slide number should remain 2/3 (no double jump).
  await expect(page.getByText("Leaderboard")).toBeVisible();
  await expect(page.getByText(/\b2\s*\/\s*3\b/)).toBeVisible();
});

test("manager slide number remains correct when leaderboard slides are encoded as type 2", async ({ page }) => {
  await mockQuizExport(page, quizExportPayloadLeaderboardAsType2);
  await installMockWebSocket(page, {
    manager: {
      first: [
        { delay: 100, data: { ...questionMessage, question_id: 201, question_text: "Q1" } },
        { delay: 650, data: leaderboardMessage },
      ],
      navigation: {
        next: [
          { delay: 350, data: question2Message },
          { delay: 350, data: leaderboardMessage },
        ],
      },
    },
  });

  await page.goto("/manager/presentation/33");

  await expect(page.getByText("Leaderboard")).toBeVisible();
  await expect(page.getByText(/\b2\s*\/\s*4\b/)).toBeVisible();

  await page.getByRole("button", { name: /next|بعدی|اسلاید بعدی/i }).click();
  await expect(page.getByText("Q2")).toBeVisible();
  await expect(page.getByText(/\b3\s*\/\s*4\b/)).toBeVisible();

  await page.getByRole("button", { name: /next|بعدی|اسلاید بعدی/i }).click();
  await expect(page.getByText("Leaderboard")).toBeVisible();
  await expect(page.getByText(/\b4\s*\/\s*4\b/)).toBeVisible();
});

test("manager and player render content slide when websocket sends type 2 content payload", async ({ page }) => {
  await mockQuizExport(page);
  await installMockWebSocket(page, {
    manager: {
      first: [{ delay: 80, data: contentMessageType2 }],
    },
  });

  await page.goto("/manager/presentation/33");
  await expect(page.getByText("Content Live")).toBeVisible();
  await expect(page.getByText("Runtime content from WS")).toBeVisible();
  await expect(page.getByText(/\b3\s*\/\s*3\b/)).toBeVisible();

  await installMockWebSocket(page, {
    player: {
      first: [{ delay: 80, data: contentMessageType2 }],
    },
  });

  await page.addInitScript(() => {
    const profile = {
      room_id: "33",
      name: "content-player",
      avatar: "A",
      user_id: "content-player-33",
    };
    localStorage.setItem("presentation_player_profile_v1", JSON.stringify(profile));
    localStorage.setItem("player_name", profile.name);
    localStorage.setItem("character", profile.avatar);
    localStorage.setItem("user_id", profile.user_id);
  });

  await page.goto("/player/presentation/33");
  await expect(page.getByText("Content Live")).toBeVisible();
  await expect(page.getByText("Runtime content from WS")).toBeVisible();
});

test("player refresh on leaderboard exits syncing state after auto-resume join", async ({ page }) => {
  await mockQuizExport(page);
  await page.addInitScript(() => {
    const profile = {
      room_id: "33",
      name: "resume-player",
      avatar: "A",
      user_id: "resume-player-33",
    };
    localStorage.setItem("presentation_player_profile_v1", JSON.stringify(profile));
    localStorage.setItem("player_name", profile.name);
    localStorage.setItem("character", profile.avatar);
    localStorage.setItem("user_id", profile.user_id);
    sessionStorage.setItem("presentation_player_seen_active_v1:33", "1");
  });

  await installMockWebSocket(page, {
    player: {
      first: [],
      join: [{ delay: 150, data: leaderboardMessage }],
    },
  });

  await page.goto("/player/presentation/33");
  // Depending on timing, player may briefly show syncing or jump directly to leaderboard.
  await expect(page.getByText("ali")).toBeVisible();
  await expect(page.locator('input[type="text"]')).toHaveCount(0);
});

test("player refresh during question stays on question instead of join page", async ({ page }) => {
  await page.addInitScript(() => {
    const profile = {
      room_id: "33",
      name: "e2e-player",
      avatar: "A",
      user_id: "e2e-user-33",
    };
    localStorage.setItem("presentation_player_profile_v1", JSON.stringify(profile));
    localStorage.setItem("player_name", profile.name);
    localStorage.setItem("character", profile.avatar);
    localStorage.setItem("user_id", profile.user_id);
  });

  await installMockWebSocket(page, {
    player: {
      first: [{ delay: 80, data: questionMessage }],
      next: [{ delay: 120, data: { type: 7, users: [] } }],
    },
  });

  await page.goto("/player/presentation/33");
  await expect(page.getByText("What is 2 + 2?")).toBeVisible();

  await page.reload();
  await expect(page.getByText("What is 2 + 2?")).toBeVisible();
  await expect(page.locator('input[type="text"]')).toHaveCount(0);
});
