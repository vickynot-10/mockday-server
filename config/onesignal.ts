import * as OneSignal from "@onesignal/node-onesignal";

let client: OneSignal.DefaultApi | null = null;

export function ConnectOneSignal() {
  if (client) return client;

  const token = process.env.ONESIGNAL_REST_API_KEY;

  if (!token) {
    throw new Error("ONESIGNAL_REST_API_KEY is not set in environment variables");
  }

  const configuration = OneSignal.createConfiguration({
    restApiKey: token,
  });

  client = new OneSignal.DefaultApi(configuration);
  console.log("OneSignal connected successfully");
  return client;
}

export const onesignal = () => {
  if (!client) {
    throw new Error("OneSignal not connected yet");
  }
  return client;
};