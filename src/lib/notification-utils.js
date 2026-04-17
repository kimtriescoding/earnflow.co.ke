import Notification from "@/models/Notification";

export async function createNotification(data) {
  return Notification.create(data);
}
