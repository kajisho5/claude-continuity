import type { onboarding as Ja } from "../ja/onboarding";

export const onboarding: typeof Ja = {
  steps: { plan: "Plan", day: "Grant day", key: "API key" },
  keyConnected: (n: number) => `Connected (${n} ${n === 1 ? "model" : "models"} available)`,
  eyebrow: (step: number) => `Setup · ${step} / 3`,
  plan: {
    title: "Choose your Claude plan",
    lead: "Depending on your plan, the app tracks the balance and expiry of the API credits granted each month.",
    hint: "ⓘ You can check your plan in claude.ai under Settings › Billing. You can change it later in the API settings."
  },
  day: {
    title: "When are your credits granted?",
    lead: "Choose the day of the \"next billing date\" shown in claude.ai under Settings › Billing.",
    resetDay: "Monthly grant day",
    teamAmount: "Team's monthly total (USD, up to $500)",
    teamPlaceholder: "e.g. 260",
    selectedPlan: "Selected plan",
    perMonth: (amount: string) => `${amount} a month in API credits`,
    change: "Change",
    preview: "Current cycle preview",
    expiresIn: " · expires in ",
    days: (n: number) => `${n} ${n === 1 ? "day" : "days"}`,
    grant: (amount: string) => ` · grant ${amount}`,
    approx: "The grant time is not published, so this is approximate to the day.",
    calibrate: "Calibrate with the Console balance (optional, can be done later)",
    balancePlaceholder: "$ balance (e.g. 132.50)"
  },
  key: {
    title: "Enter your Anthropic API key",
    lead: "Use a key created in the Console organization that receives the credits.",
    receiveTitle: "Receive the credits",
    receiveBody: "In claude.ai Billing, link a Console organization under \"API credits\".",
    openBilling: "Open Billing",
    createTitle: "Create an API key",
    createBefore: "\"Create key\" → choose a name, an expiry and a ",
    createWorkspace: "workspace",
    createAfter: ", then create it. The key is shown only once, when it is created.",
    openKeys: "Open API keys",
    testTitle: "Paste it and test the connection",
    testBody: "Before saving, checks that the key can fetch the model list.",
    testing: "Checking…",
    test: "Test connection",
    storage: "Stored encrypted in the OS's secure storage.",
    officialSteps: "Official guide to receiving credits"
  },
  later: "Set up later",
  back: "Back",
  enterLater: "Enter later",
  done: "Done",
  next: "Next",
  saveAndStart: "Save and start"
};
