Source: https://docs.customer.io/messaging/send/timezones/message-limits
Title: Set up message frequency limits - Customer.io Documentation
Fetched: 2026-11-20T03:31:43.585Z

10

# Set up message frequency limits

Copy pageCopy page

Copy pageCopyCopy linkCopy link[View MarkdownMarkdown](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits.md)Ask your LLMAsk LLM

You can add one or more message limits for your workspace, and then decide which workflows and messages count towards your limits.

By default, limits don’t apply to any of your messages.

To learn more about message frequency limits, which message channels are supported, and how your workflows calculate message limit time frames, go to [Overview: Message frequency limits](https://docs.customer.io/messaging/send/message-limits/overview/).

This video shows you how to set up a message limit and apply limits to workflows, like automations.

Customer.io Message Frequency Limits Explained

![](https://fast.wistia.net/embed/medias/g6pwwnei66/swatch)

Press O for more options

![Set message limits per channel](https://fast.wistia.net/embed/medias/g6pwwnei66/swatch)

![Set message limits per channel](https://embed-ssl.wistia.com/deliveries/addb98772bab85ce91cf4a7e2ba70402.webp?image_crop_resized=640x360)

Click for sound

![Logo](https://embed-ssl.wistia.com/deliveries/55fb32b17109452fc8db2f84507ab718.png)

5:02

Set a message limit

Assign a limit to a campaign

Change the limit for a message

Assign a limit to other workflows

## 1\. Set a workspace message limit [Copy link to "1. Set a workspace message limit"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#set-a-workspace-message-limit)

1. Go to [_\> Workspace Settings_](https://fly.customer.io/workspaces/last/settings/actions/message_frequency_limits) and select **Message frequency limits**.

2. Click **Create limit**.

3. Set limits [per channel](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/#add-a-channel-limit) or [across channels](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/#add-a-shared-limit). The maximum time frame is 31 days.

By default, you see channels set up in your workspace. To remove a channel limit, click .

4. [Set a **retry window**](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/#add-a-retry-window) if you want automations or API-triggered broadcasts to automatically retry messages after a person reaches the message limit. The maximum window is 48 hours.

Automatic retries do not apply to one-time sends or transactional messages.

5. Click **Create limit**.


By default, no workflow counts towards a limit, and your messages inherit this setting from your workflow. So your next step is to [count a workflow towards a message limit](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/#count-a-workflow-towards-a-message-limit).

### Add a channel limit [Copy link to "Add a channel limit"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#add-a-channel-limit)

When you create a new message limit, you see a list of available channels. Either modify the default settings or remove a channel by clicking .

To add a channel back, click **Add channel limit**.

![](https://docs.customer.io/images/message-channel-limit.png)

Enter a message limit and time frame for each channel.

[Learn more about which message channels you can limit](https://docs.customer.io/messaging/send/message-limits/overview/#limits-dont-apply).

### Add a shared limit [Copy link to "Add a shared limit"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#add-a-shared-limit)

If you want to count multiple channels towards the same limit, click **Add a shared limit**.

![](https://docs.customer.io/images/message-channel-limit-2.png)

Then add each channel and enter the shared message limit and time frame.

You can combine individual channel and shared limits to meet a total capacity too:

- If you had a shared limit of 3 emails and SMS per week and an individual channel limit of 1 push notification per week, that would mean a person could receive up to 3 emails and SMS and up to 1 push notification, which means no more than 4 messages total per week.

- If you had a shared limit of 3 emails and SMS per week and an individual channel limit of 1 email per week, then people would receive up to 3 messages per week and no more than 1 email.
![](https://docs.customer.io/images/individual-and-shared-limit.png)

### Add a retry window [Copy link to "Add a retry window"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#add-a-retry-window)

When you set up a message limit, you can turn on a retry window. A retry window starts when your message hits the message limit—it’s attempted, but blocked. You can set the length of the window—up to 48 hours.

For automatic retries to work reliably, set your retry window to at least as long as your message limit timeframe.

![](https://docs.customer.io/images/shared-retry-window.png)

Learn more about [how we calculate retry windows and retry messages](https://docs.customer.io/messaging/send/message-limits/overview/#understand-automatic-retries). You can find [best practices](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/#best-practices-for-message-limits), like how to think about limit time frames vs retry windows, below.

## 2\. Count a workflow towards a message limit [Copy link to "2. Count a workflow towards a message limit"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#count-a-workflow-towards-a-message-limit)

After you create a message limit, you have to assign it to the workflows you want to apply to the limit. You can set the limit on automations, API-triggered broadcasts, one-time sends, and transactional messages, and the limit automatically applies to messages in the workflow. You can also apply (or remove) the limit for individual messages within workflows.

### Automations & API-triggered broadcasts [Copy link to "Automations & API-triggered broadcasts"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#automations--api-triggered-broadcasts)

1. Open your workflow.
2. Click  and choose **Message settings**.
3. Under _Message frequency limit_, select your limit.
![](https://docs.customer.io/images/message-limit-campaign.png)
4. Decide if you want to enable _Auto-retry messages_ for the workflow. By default, retries are off.

#### Change the message limit for a single message [Copy link to "Change the message limit for a single message"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#change-the-message-limit-for-a-single-message)

By default, messages within an automation or API-triggered broadcast respect the message limit set for the workflow. You can change the setting for individual messages to follow a different message limit or ignore the workflow’s setting.

1. Click your message block—Email, SMS, WhatsApp, LINE, Push notification, or Send and receive data (for webhooks).
2. Select _Settings_.
3. Under _Message frequency limit_, select your limit.
4. Decide if you want to enable _Auto-retry settings_ for the message. By default, retries are off.

### Broadcasts: One-time sends [Copy link to "Broadcasts: One-time sends"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#one-time-sends)

1. On step 1 of a one-time send, define your recipients to reveal message sending options.
2. Under _Sending options_, select your limit.

![](https://docs.customer.io/images/message-limit-newsletter.png)

You can’t set up one-time sends to automatically retry, but you can [manually retry them](https://docs.customer.io/messaging/send/message-limits/review-message-limits/#manually-retry-messages-after-going-over-the-limit).

### Transactional messages [Copy link to "Transactional messages"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#transactional-messages)

From _Configure settings_, enable the toggle **Assign message frequency limit?** and choose your limit.

![](https://docs.customer.io/images/message-limit-transac.png)

You can’t set up transactional messages to automatically retry, but you can [manually retry them](https://docs.customer.io/messaging/send/message-limits/review-message-limits/#manually-retry-messages-after-going-over-the-limit).

## Change a workspace message limit in use [Copy link to "Change a workspace message limit in use"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#change-a-workspace-message-limit-in-use)

Changes to your message limit and retry settings take effect within minutes, but until then, your workspace continues to respect the limit and retry settings you had in place.

Learn more about how changing live settings impacts your workspace below.

### Delete a workspace message limit [Copy link to "Delete a workspace message limit"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#delete-a-workspace-message-limit)

Deleting a message limit in your workspace settings means that any workflow or message that used it no longer counts towards that message limit.

For instance, if someone reached your message limit of two emails per day, and you delete that message limit from workspace settings, that person can start receiving more than two emails that day from workflows that used the deleted limit.

### Disable auto-retry [Copy link to "Disable auto-retry"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#disable-auto-retry)

Changes to auto-retry settings cascade down across the workflows and messages they apply to. Any scheduled attempts finish retrying, but further retries are canceled.

#### In workspace settings [Copy link to "In workspace settings"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#in-workspace-settings)

After you turn off auto-retry for a message limit in workspace settings, your workspace finishes scheduled retries across the workflows the limit applied to. If these last attempts fail, your workspace stops retrying the messages originally blocked by the limit.

Once the auto-retry setting is off at the workspace level, you can’t assign a retry setting for the message limit in any workflow or message.

Disabling auto-retry on the message limit in workspace settings also disables the auto-retry setting for any workflow or message set to “Use message frequency limit settings”.

Disabling this setting **does not** turn off custom retry windows on workflows or messages. For example, if you turn off a 24-hr retry window for a message limit, but an automation used the limit and a custom retry window of 12 hours, then that custom retry window on the automation remains active.

#### In a workflow [Copy link to "In a workflow"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#in-a-workflow)

After you turn off auto-retry for a message limit in a workflow (automation, API-triggered broadcast, one-time send, or transaction message), your workspace finishes scheduled retries from that workflow. If these last attempts fail, your workspace stops retrying the messages blocked by the limit.

#### In a message [Copy link to "In a message"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#in-a-message)

After you turn off auto-retry for a message limit on a message (in an automation or API-triggered broadcast), your workspace finishes scheduled retries for this message. If these last attempts fail, your workspace stops retrying this message.

## Best practices for retry windows [Copy link to "Best practices for retry windows"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#best-practices-for-message-limits)

### Set your retry window to the length of your limit time frame or longer [Copy link to "Set your retry window to the length of your limit time frame or longer"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#set-your-retry-window-to-the-length-of-your-limit-time-frame-or-longer)

**For automatic retries to work reliably, set your retry window to at least as long as your message limit timeframe.** If the retry window is shorter than the limit time frame, retries won’t succeed as often as you may want.

For example, imagine your automation message limit is two emails per 24 hours and your retry window is 12 hours:

- If your workspace retries an attempted message in the first 12 hours after the oldest counted email, the limit won’t reset before the retry window closes. Your workspace marks the attempted message as _Undeliverable_ right away and does not retry it.
- If your workspace retries an attempted message between 12 and 24 hours after the oldest counted email, the limit resets before the retry window closes. So your workspace can send the message successfully about 24 hours after the oldest counted email.

### Account for timing edge cases with automatic retries [Copy link to "Account for timing edge cases with automatic retries"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#account-for-timing-edge-cases-with-automatic-retries)

Your workspace compares message delivery timestamps down to the second. The exact time at which we process deliveries can change based on fluctuations in the number of people in your automation, the number of active people in your workspace, current system load, and more.

To account for this timing fluctuation, you can set up automatic retries on automations and API-triggered broadcasts.

However, you can’t set up automatic retries on one-time sends or transactional messages. So if you run into undeliverable messages due to fluctuations in timing around the message limit, consider [manually resending those messages](https://docs.customer.io/messaging/send/message-limits/review-message-limits/#manually-retry-messages-after-going-over-the-limit).

### Prevent retries on messages from an automation a person exited [Copy link to "Prevent retries on messages from an automation a person exited"](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/\#prevent-retries-on-messages-from-an-automation-a-person-exited)

When you enable auto-retry, your workspace automatically retries messages that were blocked due to the message limit, even if a person exited the automation the message came from.

You can’t prevent this behavior entirely, but you can turn off auto-retry to prevent fewer retries from being sent. Learn about [disabling auto-retries](https://docs.customer.io/messaging/send/message-limits/set-up-message-limits/#disable-auto-retry).

Was this page helpful?

Updated October 29, 2026

Loading more...