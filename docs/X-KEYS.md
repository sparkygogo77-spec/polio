# Posting to X from the tweet console

The console drafts, previews and schedules on its own. To **send** a post
from the app, the server needs four keys from an X developer account. With
none set, Send opens X's compose page with your words instead, and you press
Post there (pictures do not travel that way).

## Getting the keys

1. Go to <https://developer.x.com> and sign in with the account the posts
   should come from. Sign up for the developer platform if asked. The free
   tier allows a limited number of posts a month; check the current limit
   on the sign-up page.
2. In the developer portal, create a **Project**, then an **App** inside it.
3. Open the app's **User authentication settings** and set it up:
   - App permissions: **Read and write** (media upload needs write).
   - Type of app: **Web App, Automated App or Bot**.
   - Callback URL and Website URL: anything valid, for example your site's
     address. They are not used by this app.
4. Open the app's **Keys and tokens** tab:
   - Under *Consumer Keys*, generate the **API Key and Secret**.
   - Under *Authentication Tokens*, generate the **Access Token and Secret**.
     Do this **after** setting Read and write, or the token comes out
     read-only; if you changed the permission later, regenerate it.
5. Put them in `.env.local` (copy `.env.example` first) and restart:

```
X_API_KEY=…
X_API_SECRET=…
X_ACCESS_TOKEN=…
X_ACCESS_SECRET=…
X_HANDLE=yourhandle        # optional, shown in the console
X_MEDIA_API=v2             # optional, v2 (default) or v1.1 for media upload
```

6. Open the console (press `T`). The chip in the header reads **API ready**.
   Send one short test post; if X refuses it, the exact error shows next to
   the draft.

## What the keys do

| Key | Identifies |
|---|---|
| `X_API_KEY` / `X_API_SECRET` | The app |
| `X_ACCESS_TOKEN` / `X_ACCESS_SECRET` | The account the posts go out as |

They stay on the server. The browser only ever learns *whether* they are
set (`GET /api/tweets/status`), never what they are.

## Limits worth knowing

- The queue runs only while the app is open in a browser. A post that comes
  due while it is closed is sent up to three hours late (a setting), then
  marked missed and offered again.
- X takes GIF and MP4, not WebM. The console makes a GIF of a recorded tour
  itself, so nothing needs installing for that.
- A thread that half-posted is never retried on its own, because a retry
  would post the first half again.
