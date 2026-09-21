/** Dispatched by any page that wants to open the widget itself, for example the Contact page's "Live chat" row,
 * instead of just describing where the launcher is. Kept apart from the widget so a page can send it without
 * pulling the whole chat code into its bundle. */
export const OPEN_CHAT_EVENT = "bestcar:open-chat";
