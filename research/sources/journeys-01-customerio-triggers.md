Source: https://docs.customer.io/journeys/campaign-triggers/
Title: Automation triggers, filters, and frequencies - Customer.io Documentation
Fetched: 2026-11-20T03:31:33.490Z

30

# Automation triggers, filters, and frequencies

Copy pageCopy page

Copy pageCopyCopy linkCopy link[View MarkdownMarkdown](https://docs.customer.io/messaging/send/automations/triggers.md)Ask your LLMAsk LLM

Automation triggers determine who enters your automations and when. This page describes different kinds of triggers and why you might use them.

If you’re just getting started, we’ve created a quick video to help you understand what each automation trigger does. To learn about triggers based on custom objects and relationships, see [Custom object triggers](https://docs.customer.io/messaging/send/automations/object-triggers/).

Campaign Triggers

![](https://fast.wistia.net/embed/medias/y0dy02b87a/swatch)

Press O for more options

![Understand the different kinds of campaign triggers](https://fast.wistia.net/embed/medias/y0dy02b87a/swatch)

![Understand the different kinds of campaign triggers](https://embed-ssl.wistia.com/deliveries/0c2f566e094e2ca31a3422d97ee9dce0.webp?image_crop_resized=640x360)

Click for sound

5:16

## How it works [Copy link to "How it works"](https://docs.customer.io/messaging/send/automations/triggers/\#how-it-works)

An automation _trigger_ determines who enters your automation and when. You can set up _filters_ to narrow your trigger criteria. People need to meet your trigger and filter criteria to enter your automation. You can also set your [exit conditions](https://docs.customer.io/messaging/send/automations/exit-conditions/) to make people exit your automation when they quit matching your trigger and filter criteria, ensuring that your automation is relevant to your audience.

If you want to let people experience an automation multiple times, you can set _frequency_ settings, determining how often a person can trigger an automation.

yes

yes

no

no

Does a person meet

trigger conditions?

Does person meet

filter conditions?

person enters

automation

person doesn't

enter automation

### What kinds of actions trigger an automation? [Copy link to "What kinds of actions trigger an automation?"](https://docs.customer.io/messaging/send/automations/triggers/\#what-kinds-of-actions-trigger-an-automation)

Your automation trigger determines who enters your automation and when. Most triggers are based around people, like when they match certain criteria. Typically, these people are the subject of your automation—you’ll send them messages, set their attributes, and so on.

![The automation trigger has a left hand column with a list of trigger categories including All Triggers, People, Object Types indicated by their names, Dates, and Webhooks. All Triggers is selected and shows a list of People triggers: segment change, event, and form submission.](https://docs.customer.io/images/campaign-triggers-2025-all.png)

### Trigger options [Copy link to "Trigger options"](https://docs.customer.io/messaging/send/automations/triggers/\#trigger-options)

**Attribute or Segment**

_Attribute or Segment_ lets you trigger automations based on profile
The record that represents a person or object in Customer.io. A person is the human; their profile is everything you know about them in your workspace, like their attributes, activity, and message history. People and objects both have profiles, and we bill based on the total number of profiles in your account.
attributes, [segments\\
A segment is a group of people in your workspace. Use segments to trigger automations, track membership over time, or fine-tune your audience. There are three types of segments: data-driven, snapshot, and manual. Data-driven segments automatically update when people start or stop matching criteria. Snapshot segments capture everyone who matches at a point in time and only change when you refresh them. Manual segments are static groups of people.](https://docs.customer.io/journeys/segmentation/segments/) , or both. Use segments if you want to track people who match this criteria over time or reuse the criteria as a trigger for other automations. You can set segment criteria based on your audience’s attributes, events, etc. Use attributes alongside segments or to quickly target specific profile attributes without creating or finding a segment. This trigger is best for automations like recurring NPS surveys, onboarding drip automations, and inactivity reminders.

**Event**

An [event\\
Something that a person in your workspace did. Events can trigger automations, add people to segments, etc, and you can use properties from events to personalize messages.](https://docs.customer.io/journeys/people/events/) -triggered automation helps you respond to a person’s activity in your app or website. For instance, you could trigger an automation based on a user abandoning their cart, viewing a specific page on your app, or completing an order.

**Form submission**

_Form submission_ lets you take advantage of [form\\
Connected Forms in Customer.io allow you to automatically trigger automations, send data to other services, and add or update people when they submit forms on your website or in your app.](https://docs.customer.io/integrations/data-in/connections/forms/connected-forms/) responses to trigger automations. You can [connect a form to your workspace](https://docs.customer.io/integrations/data-in/connections/forms/connected-forms/) or [integrate with Facebook Lead Ads](https://docs.customer.io/integrations/data-in/connections/forms/facebook-lead-ads/). Use this type of automation to send messages to nurture new leads or respond to support requests.

**Important date**

An _important date_ triggers automations on a specific or relative date based on an [attribute\\
A key-value pair that you associate with a person or an object—like a person's name, the date they were created in your workspace, or a company's billing date etc. Use attributes to target people and personalize messages.](https://docs.customer.io/journeys/people/manage/attributes/) that people or [custom objects\\
An object is a non-person entity that you can associate with one or more people—like a company, account, or online course.](https://docs.customer.io/messaging/objects-data/objects/start/) have. You can trigger based on any attributes that are properly [formatted dates](https://docs.customer.io/messaging/send/automations/triggers/#date-trigger). This is useful for recurring automations like birthdays, anniversaries, subscription renewals, and payment reminders.

**Geofence set**

_Premium & Enterprise only:_ You can trigger an automation based on when a person enters, stays in (dwells), or exits a [geofence set\\
A named group of geofences that you act on together—for example, trigger a campaign when a person enters any geofence in the set. When a person crosses a geofence, our mobile SDKs send a `Geofence Transition` event for each geofence set the geofence belongs to.](https://docs.customer.io/messaging/people/location/geofences/) to send personalized messages and offers in certain locations. You might use this trigger for parking reminders, nearby EV charger notifications, event or venue engagement, travel hub messaging, and location-based audience engagement.

**Object**

Use the _Object_ trigger to start an automation based on [custom objects](https://docs.customer.io/messaging/objects-data/objects/start/)

[An object is a non-person entity that you can associate with one or more people—like a company, account, or online course.](https://docs.customer.io/messaging/objects-data/objects/start/)

and the people related to them. You set conditions for the object, the person’s relationship to it, and the person’s own attributes or segments, and people enter when all of those conditions are true. For instance, if you track accounts as objects, you could message a person when they become a manager of an account on a premium plan. Only people enter journeys, not objects. Learn more about [custom object triggers](https://docs.customer.io/messaging/send/automations/object-triggers/).

**Webhook**

A _webhook_ triggers a [automation](https://docs.customer.io/messaging/send/automations/data-workflows/webhook-triggered-automations/) based on data from an external service. The purpose of your automation is to manipulate this data and associate it with people, much like you can with Zapier or Segment, but entirely within an automation. Because data, not people, is the subject of your automation, webhook-triggered automations don’t typically send messages directly; rather, they let you associate data with people, which can trigger subsequent automations.

Webhook automations help you perform one-to-many interactions with your audience, like notifying a group of people when you post a job or a product becomes available that a cohort of your audience is interested in.

## Triggers with segments [Copy link to "Triggers with segments"](https://docs.customer.io/messaging/send/automations/triggers/\#triggers-with-segments)

Our [**attribute or segment**](https://docs.customer.io/messaging/send/automations/triggers/#conditions-trigger) trigger lets you launch automations based on people’s attributes—like plan type, region, or signup date—without needing to build a segment first. And when you need more control, you can still use segments alongside attributes.

This new trigger launched in April 2025. Any automations made with our [legacy segment trigger](https://docs.customer.io/messaging/send/automations/triggers/#condition-trigger) will continue to run as expected. You can still edit their triggers and [duplicate legacy segment-triggered automations](https://docs.customer.io/messaging/send/automations/statuses/#duplicate-legacy-segment-triggered-automations) too.

| Legacy segment trigger | Latest segment trigger |
| --- | --- |
| ![Outlines what differentiates a legacy segment trigger from the latest segment trigger.](https://docs.customer.io/images/legacy-segment-trigger-comparison.png) | ![Outlines what differentiates the latest segment trigger from the legacy segment trigger.](https://docs.customer.io/images/latest-segment-trigger-comparison.png) |

### Differences between triggers: _attribute or segment_ vs _segment change_ [Copy link to "Differences between triggers: attribute or segment vs segment change"](https://docs.customer.io/messaging/send/automations/triggers/\#differences-between-triggers-attribute-or-segment-vs-segment-change)

The new attribute or segment trigger gives you more flexibility and control over when people enter your automation. While it works differently from our legacy segment trigger, it’s designed to simplify setup and avoid unnecessary journeys. Here’s what’s different:

- Filter conditions are now part of the trigger conditions.
- You may need to add time-based conditions to ensure the right group of people trigger your automations.

#### Filter conditions are now part of the trigger conditions

In the legacy segment trigger, you could add filters to your trigger conditions to narrow your audience further. People would enter the automation when they matched the trigger segment—but they wouldn’t move through the workflow unless they also matched the filters.

This often led to unnecessary [journeys](https://docs.customer.io/messaging/metrics/automation-metrics/#journeys-tab): people would log as having entered the automation, but never move forward because they didn’t meet your filters. Eventually, they’d exit the journey without receiving any messages.

With the new attribute or segment trigger, you define previous filter conditions in the trigger itself. That means:

- People only enter the automation when they meet all your criteria.
- You avoid incomplete journeys and keep your reporting clean.

#### Add time-based logic to target the right users

You may need to add time-based conditions to ensure the right group of people trigger your automations.

The legacy segment trigger included automatic “matchtime” logic — it looked at the following to decide when people should enter an automation:

- When relevant attributes were last updated
- When relevant events were last sent
- The timestamp itself of relevant date/time attributes

The new trigger doesn’t do this automatically. Instead, you define when people should enter using time-based conditions in your trigger or delays in your workflow. This gives you more control and predictability.

Here’s how this works in practice:

Migrate users and backfill data

Imagine you have a running automation that uses a legacy segment trigger. People enter when they join the segment “Signed Up.” The segment is defined by a person’s attribute `created_at is a timestamp`. Then you migrate some users from another platform to Customer.io and backfill their data. If their `created_at` timestamps are more than 24 hours before now, those people _would not_ trigger the automation.

With the new attribute or segment trigger, people will enter the automation as long as they meet the trigger conditions—regardless of how old their data is. That means backfilled users could start the automation right away.

To exclude people with older timestamps, add a time-based trigger condition like `Attribute: created_at is a timestamp after a relative date of 1 day ago`.

![](https://docs.customer.io/images/att-or-seg-timestamp-condition-1-day-ago.png)

This ensures that only people whose `created_at` timestamp is within the last day will trigger the automation.

Delay people at the beginning of your automation

Imagine you have an automation that uses a legacy segment trigger. People enter when they join the segment “Trial users” which is based on the condition `plan_type is equal to trial`. The first step in your automation is a 3-day Wait until block. You start the automation and include current matches in the audience.

If someone’s `plan_type` updated to `trial` 1 day ago, matchtime logic would apply. That person would only wait 2 more days because of the time of their attribute update.

With the new attribute or segment trigger, matchtime isn’t used. People enter the automation the moment they meet the trigger condition and would wait the full 3 days.

If you want to time the delay based on when someone actually started their trial, pass a timestamp attribute like `trial_start_date`, and use it in a condition of a Wait until block at the beginning of your automation: `trial_start_date is a timestamp after a relative date of 3 days ago`.

![](https://docs.customer.io/images/att-or-seg-timestamp-condition-trial-wait.png)

This gives you full control over when people move forward, based on the actual timing of their trial—not just when they entered the automation.

Wait until a future date

Both of the previous examples showcase matchtimes in the _past_. Let’s take a look at one more example where matchtimes are in the _future_.

Imagine you have an automation that starts when someone purchases a new subscription. The automation uses a legacy segment trigger where the segment is defined by the condition `plan_start is a timestamp`. Let’s say someone’s `plan_start` is in two days.

In this setup, this person would enter the automation before their plan starts—but they would be held at the beginning of your workflow until the timestamp (their actual plan start date) is reached.

With the new attribute or segment trigger, people start the workflow as soon as they meet the trigger conditions. That means they won’t automatically wait until the plan start date unless you explicitly add that logic.

If you want people to wait until a future date, use a [date-triggered automation](https://docs.customer.io/messaging/send/automations/triggers/#date-trigger). In some cases, adding a Wait until block at the start of your workflow (based on a timestamp like plan\_start) can work too.

**More on matchtimes**

These examples include simple triggers, but if you want to calculate matchtimes for legacy segment triggers with multiple conditions, consider the following:

- If the conditions are joined by an AND, the matchtime is the _most recent_ of the conditions.
- If the conditions are joined by an OR, the matchtime is the _oldest_ of the conditions.

### Attribute or segment [Copy link to "Attribute or segment"](https://docs.customer.io/messaging/send/automations/triggers/\#conditions-trigger)

With the _Attribute or Segment_ trigger, you can target a range of data through segments or quickly specify profile attributes to define your audience:

- Add profile
The record that represents a person or object in Customer.io. A person is the human; their profile is everything you know about them in your workspace, like their attributes, activity, and message history. People and objects both have profiles, and we bill based on the total number of profiles in your account.
attributes to quickly target people who should trigger this automation
- Add [segments\\
A segment is a group of people in your workspace. Use segments to trigger automations, track membership over time, or fine-tune your audience. There are three types of segments: data-driven, snapshot, and manual. Data-driven segments automatically update when people start or stop matching criteria. Snapshot segments capture everyone who matches at a point in time and only change when you refresh them. Manual segments are static groups of people.](https://docs.customer.io/journeys/segmentation/segments/) if you want to reuse a specific set of criteria across automations and track membership over time
- Or add attributes AND segments to the trigger criteria to hone in on your exact audience

You can only directly specify _profile_ attributes

If you want to target event attributes, message data, object attributes, etc, you’d have to create a segment with that criteria.

Click **Attribute or Segment** to get started:

![](https://docs.customer.io/images/campaign-triggers-2024-attribute-or-segment.png)

Then choose your trigger criteria. Choose whether people should meet **All** or **At least one** condition to start the automation. You can specify profile attribute conditions and/or segments.

![](https://docs.customer.io/images/campaign-triggers-condition-trigger.png)

You cannot create automations with only a _not in_ segment condition

If you’re triggering an automation using segments, the trigger must have at least one _**in**_ condition or one profile attribute condition for you to save it. We do not trigger automations solely off of people not belonging to a segment.

#### Frequency [Copy link to "Frequency"](https://docs.customer.io/messaging/send/automations/triggers/\#aos-frequency)

By default, people will enter your automation once. If your automation does not use a _Filter_, you can let customers enter your automation multiple times with the **Frequency** setting. When you enable _Frequency_ settings, you’ll use one of these options to determine how often a person can re-enter your automation:

- **Every re-match**: people will enter this campaign when they match and re-match the trigger conditions; they must stop matching the trigger conditions then re-match the conditions to re-trigger the campaign.



  - They must re-match _after_ they’ve exited the automation, which means if they re-match during the automation, they will not re-trigger the automation upon exiting. They would have to stop matching and re-match again after they exit the automation.
  - They must re-match _after_ the minimum wait time has elapsed, as well. In the example below, the minimum wait time is 1 day.
  - For example, imagine an automation that triggers when someone joins the segment “Inactive for two weeks” and the frequency is “Every re-match.” When people enter that segment, they trigger an automation and receive a message. Later, they exit the automation. Then the minimum wait time elapses. To re-enter the automation, they must exit then re-enter the “Inactive for two weeks” segment (become active, then become inactive again).

![](https://docs.customer.io/images/segment-trigger-frequence-every-rematch.png)

- **At fixed intervals**: people will repeat the campaign at a set interval, provided they match the conditions when the interval elapses.



  - A person cannot re-trigger an automation while they have an active automation journey.
  - The automation will check if a person can re-enter based on their initial journey.
    - For example, imagine an automation has a frequency of “At fixed intervals” and two days should elapse between entry and re-entry. If a person’s first journey started March 22 at 11 am, then the automation will check for re-entry on March 24 at 11 am. If the journey is still active, a new journey won’t begin. The next time it will check is March 26 at 11 am. If they exited the automation at 9 am on the 26th, they would start a new journey. However, if they don’t exit until 12 pm, they won’t re-enter again until the 28th at 11 am.

We start to measure the interval when a person enters the automation

Even if your automation includes a delay, the interval window begins when a person matches your automation conditions.

![](https://docs.customer.io/images/segment-trigger-frequence-fixed-interval.png)

Frequency settings apply to people you manually remove from automations

You can [manually remove](https://docs.customer.io/messaging/send/automations/overview/#manually-end-a-journey) people from automations, but this won’t necessarily cause them to re-enter the automation. For example, if a person can only enter an automation once ever, and you remove a person from the automation, they’ll _never_ re-enter the automation.

### Deprecated: Segment change [Copy link to "Deprecated: Segment change"](https://docs.customer.io/messaging/send/automations/triggers/\#condition-trigger)

Use the [attribute or segment trigger](https://docs.customer.io/messaging/send/automations/triggers/#conditions-trigger) to create segment-triggerd automations

**We’ve phased out our “Segment change” trigger.** However, automations made with our legacy segment triggers will continue to run as expected! You can still edit the trigger and duplicate these automations too.

Segments are based on audience criteria— [attributes](https://docs.customer.io/journeys/people/manage/attributes/)

[A key-value pair that you associate with a person or an object—like a person's name, the date they were created in your workspace, or a company's billing date etc. Use attributes to target people and personalize messages.](https://docs.customer.io/journeys/people/manage/attributes/)

your audience has, events they’ve performed, making this one of our more flexible automation types.

Click **Segment change** to get started:

![](https://docs.customer.io/images/campaign-triggers-2024-segment-change.png)

We’ll prompt you to choose one or more segments that your audience is **in** or **not in**. If you haven’t created a segment yet, you can click **Create a new data-driven segment** to set conditions for a new segment.

![An image of the right hand panel that appears after you click Choose Segment on step 1 of creating a segment-triggered automation. The panel is titled Segment conditions and shows a dropdown selection of 'in' followed by an empty field with dropdown options including Create a new data-driven segment and a list of existing segments like Signed up.](https://docs.customer.io/images/segment-trigger-conditions.png)

You cannot create automations with only a _not in_ condition

A segment-triggered automation must have at least one _**in**_ condition for you to save it. We do not trigger automations solely off of people not belonging to a segment.

You can set multiple segments using _and_ or _or_ conditions. Use **and** to trigger automations only when people meet all of your conditions. Click **\+ Add condition** to create an _and_ condition.

![](https://docs.customer.io/images/segment-triggers-and-conditions.png)

Use an **or** condition to trigger an automation based on a person belonging to _any_ of the segments. Add segments to the same field to create an _or_ condition:

![](https://docs.customer.io/images/segment-trigger-or-condition.png)

You can use JSON dot notation in condition logic

If you store attributes or event data in JSON objects or arrays, you can use JSON dot notation in your branch conditions to evaluate these properties. Use `array[]` to represent any item in an array or `array[0]` to represent the first item in the array. See [Storing and using JSON](https://docs.customer.io/messaging/people/getting-started-with-json/#referencing-json-data-dot-notation) for more information about dot notation in Customer.io.

**Filter**

With segment-triggered automations, you can also add a segment filter. You should weave your segment filter criteria into your segment trigger conditions as much as possible, but if you find you cannot accomplish what you need without a segment trigger AND segment filter, [please let us know](https://docs.customer.io/support/?type=feedback)! We want to account for this use case as we develop the next generation of automations.

#### Frequency [Copy link to "Frequency"](https://docs.customer.io/messaging/send/automations/triggers/\#frequency)

By default, people will enter your automation once. If your automation does not use a _Filter_, you can let customers enter your automation multiple times with the **Frequency** setting. When you enable _Frequency_ settings, you’ll use one of these options to determine how often a person can re-enter your automation:

Campaign trigger frequency

![](https://fast.wistia.net/embed/medias/um86bzx7ol/swatch)

Press O for more options

![Video Thumbnail](https://fast.wistia.net/embed/medias/um86bzx7ol/swatch)

![Video Thumbnail](https://embed-ssl.wistia.com/deliveries/43d0b453116e9fd5a462131bedfdb2a3.webp?image_crop_resized=640x372)

Click for sound

[![Logo](https://embed-ssl.wistia.com/deliveries/55fb32b17109452fc8db2f84507ab718.png)](https://customer.io/)

0:10

- **Every re-match**: people will enter this campaign when they match and re-match the trigger conditions; they must stop matching the trigger conditions then re-match the conditions to re-trigger the campaign.



  - They must re-match _after_ they’ve exited the automation, which means if they re-match during the automation, they will not re-trigger the automation upon exiting. They would have to stop matching and re-match again after they exit the automation.
  - They must re-match _after_ the minimum wait time has elapsed, as well. In the example below, the minimum wait time is 1 day.
  - For example, imagine an automation that triggers when someone joins the segment “Inactive for two weeks” and the frequency is “Every re-match.” When people enter that segment, they trigger an automation and receive a message. Later, they exit the automation. Then the minimum wait time elapses. To re-enter the automation, they must exit then re-enter the “Inactive for two weeks” segment (become active, then become inactive again).

![](https://docs.customer.io/images/segment-trigger-frequence-every-rematch.png)

- **At fixed intervals**: people will repeat the campaign at a set interval, provided they match the conditions when the interval elapses.



  - A person cannot re-trigger an automation while they have an active automation journey.
  - The automation will check if a person can re-enter based on their initial journey.
    - For example, imagine an automation has a frequency of “At fixed intervals” and two days should elapse between entry and re-entry. If a person’s first journey started March 22 at 11 am, then the automation will check for re-entry on March 24 at 11 am. If the journey is still active, a new journey won’t begin. The next time it will check is March 26 at 11 am. If they exited the automation at 9 am on the 26th, they would start a new journey. However, if they don’t exit until 12 pm, they won’t re-enter again until the 28th at 11 am.

We start to measure the interval when a person enters the automation

Even if your automation includes a delay, the interval window begins when a person matches your automation conditions.

![](https://docs.customer.io/images/segment-trigger-frequence-fixed-interval.png)

Frequency settings apply to people you manually remove from automations

You can [manually remove](https://docs.customer.io/messaging/send/automations/overview/#manually-end-a-journey) people from automations, but this won’t necessarily cause them to re-enter the automation. For example, if a person can only enter an automation once ever, and you remove a person from the automation, they’ll _never_ re-enter the automation.

## Trigger by important dates [Copy link to "Trigger by important dates"](https://docs.customer.io/messaging/send/automations/triggers/\#date-trigger)

This option lets you trigger an automation based on a date-time [attribute](https://docs.customer.io/journeys/people/manage/attributes/)

[A key-value pair that you associate with a person or an object—like a person's name, the date they were created in your workspace, or a company's billing date etc. Use attributes to target people and personalize messages.](https://docs.customer.io/journeys/people/manage/attributes/)

stored on people or custom objects.

![](https://docs.customer.io/images/important-date-trigger.png)

The attribute must contain a date in either [Unix or ISO 8601](https://docs.customer.io/messaging/send/automations/triggers/#supported-date-formats) format. If a person doesn’t have this attribute, or the attribute isn’t in the right format, they’ll never trigger the automation.

### Dates unique to people [Copy link to "Dates unique to people"](https://docs.customer.io/messaging/send/automations/triggers/\#dates-stored-on-profiles)

You might use this trigger to wish your audience a happy birthday or thank them for being a subscriber on their renewal date.

1. When picking a trigger type, choose **Important date**.

2. Select **People** to trigger based on a date attribute stored on your audience.

3. Choose the **Date attribute**. Your workspace schedules your automation based on the _date_, not the time of this attribute. You set the time in a later step. Learn more about [accessing arrays and nested data](https://docs.customer.io/messaging/send/automations/triggers/#supported-date-attributes) and [how to format your date values](https://docs.customer.io/messaging/send/automations/triggers/#supported-date-formats).

4. Determine how frequently your audience should enter your automation.
   - **Once**: A person triggers the automation one time.
   - **Monthly**: A person can trigger the campaign once per month. For example, if the date attribute is June 5, 2026 and it triggers on the date (the 5th), then the automation triggers every month on the 5th. If the current month doesn’t include that day, like the 31st, then your workspace triggers the automation on the last day of the month.
   - **Yearly**: A person triggers the automation once per year on the same month and day. For example, if the date attribute is June 5, 2026, the automation triggers again on June 5, 2027.
5. Set your date settings:
   - `On the date`: Trigger the automation on the recurrence date.
   - `Before the date`: Trigger the automation a set number of days before the date attribute.
   - `After the date`: Trigger the automation a set number of days after the date attribute.
6. Pick the time of day that you want to trigger this automation. We won’t use the time stored in the date attribute. But, if you store your audience’s `timezone` as an attribute, you can select `the user's time zone` to trigger your automation.

Keep in mind, if you activate this campaign and the trigger matches today’s date, people only enter the campaign today if the campaign was activated BEFORE the trigger time. Otherwise, people follow your frequency settings. For instance, if you have a yearly birthday campaign and activate the campaign at 2pm CST, but the campaign is set to trigger at 1pm CST, then people with a birthday today won’t get the campaign until next year. The same applies to attribute update; if someone’s birthday is updated to today but the trigger time has passed, they won’t start the campaign until next year.


Then decide if you want to narrow the audience further by adding _Filters_. You can filter for people who belong to or don’t belong to segments. Click the trigger, and select _Filters_ to get started.

### Dates unique to custom objects [Copy link to "Dates unique to custom objects"](https://docs.customer.io/messaging/send/automations/triggers/\#dates-stored-on-custom-objects)

You might use this trigger type to remind your audience to renew their subscription 14 days before their account expires or to send reminders ahead of a reservation.

Each scheduled date can [start journeys for up to 50,000 people](https://docs.customer.io/messaging/send/automations/triggers/#understand-journey-limits) related to each object.

1. When picking a trigger type, choose **Important date**.

2. Under _Date from_, select one of your **[Object types](https://docs.customer.io/messaging/objects-data/objects/types/)**

**[An object type is a group of objects. An object type could be Online Classes while an object within the type could be English 101. Customer.io generates a unique, immutable `object_type_id`.](https://docs.customer.io/messaging/objects-data/objects/types/)**
    to trigger based on dates stored on your custom objects.

![The trigger type is set to Important date. The object type is set to Accounts. The date attribute is set to renewal_date.](https://docs.customer.io/images/campaign-triggers-object-type-important-date.png)
3. Choose the **Date attribute**. Your workspace schedules your automation based on the _date_, not the time of this attribute. You set the time in a later step. Learn more about [accessing arrays and nested data](https://docs.customer.io/messaging/send/automations/triggers/#supported-date-attributes) and [how to format your date values](https://docs.customer.io/messaging/send/automations/triggers/#supported-date-formats).

4. Determine how frequently your audience should enter your automation.
   - **Once**: A person triggers the automation one time.
   - **Monthly**: A person can trigger the campaign once per month. For example, if the date attribute is June 5, 2026 and it triggers on the date (the 5th), then the automation triggers every month on the 5th. If the current month doesn’t include that day, like the 31st, then your workspace triggers the automation on the last day of the month.
   - **Yearly**: A person triggers the automation once per year on the same month and day. For example, if the date attribute is June 5, 2026, the automation triggers again on June 5, 2027.
5. Set your date settings:
   - `On the date`: Trigger the automation on the recurrence date.
   - `Before the date`: Trigger the automation a set number of days before the date attribute.
   - `After the date`: Trigger the automation a set number of days after the date attribute.
6. Pick the time of day that you want to trigger this automation. We won’t use the time stored in the date attribute. But, if you store your audience’s `timezone` as an attribute, you can select `the user's time zone` to trigger your automation.

Keep in mind, if you activate this campaign and the trigger matches today’s date, people only enter the campaign today if the campaign was activated BEFORE the trigger time. Otherwise, people follow your frequency settings.


To filter for specific objects in your chosen object type, like a specific account or course, click the trigger block and select _Filters_. You can add one or more object attributes as filter conditions.

![The filter narrows the account objects to those with the status of active.](https://docs.customer.io/images/campaign-triggers-object-type-important-date-filters.png)

To filter which people enter the automation, click _Audience_ and choose whether every person or certain people related to these objects should enter the automation.

![The audience is set to certain people related to the object whose role is admin.](https://docs.customer.io/images/campaign-triggers-object-type-important-date-audience.png)

You can also use the triggering object’s attributes and relationships later in the workflow—in _Wait until_ blocks, branches, exit conditions, and data actions. [Learn more about workflow actions for objects and relationships](https://docs.customer.io/messaging/objects-data/objects/relationships-in-automations/#workflow-actions).

#### Understand journey limits [Copy link to "Understand journey limits"](https://docs.customer.io/messaging/send/automations/triggers/\#understand-journey-limits)

When you trigger an automation from a date stored on an object, each scheduled date can start journeys for up to 50,000 people related to each object. If you send in your audience’s time zones, the limit applies to each time zone separately.

The send won’t fail if more than 50,000 people could trigger journeys. It only sends to up to 50,000 and drops the rest. If you expect a date trigger to reach more people than this for a single object, contact us before the date arrives to talk through your use case.

### Supported date attributes [Copy link to "Supported date attributes"](https://docs.customer.io/messaging/send/automations/triggers/\#supported-date-attributes)

You can pick a date attribute from the dropdown or specify a timestamp attribute in an array or object.

For example, you can use any of these notations, depending on what’s stored on your people or objects:

- `appointment_time` \- a single timestamp attribute
- `appointments.next_date` \- a timestamp within a JSON object
- `appointment_times[0]` \- the first timestamp in an array
- `appointment_times[0].follow_up_date` \- the timestamp of the first JSON object in the array

Unfortunately, your workflow can’t show the number of people who will receive a message when you use a nested attribute. Instead, you see how many people have the parent attribute (i.e. `appointments`).

### Supported date values [Copy link to "Supported date values"](https://docs.customer.io/messaging/send/automations/triggers/\#supported-date-formats)

Automations trigger based on a [Unix ↗](https://www.unixtimestamp.com/) or ISO 8601 format. These are the ISO 8601 date-time formats we support:

| ISO 8601 Format | Example |
| --- | --- |
| YYYY-MM | 2024-03 (This will default to the first of the month.) |
| YYYY-MM-DD | 2023-11-15 |
| YYYY-MM-DDThh:mm:ssZ | 2023-11-15T23:14:37Z |
| YYYYMMDDThh:mm:ssZ | 20231115T231437Z |
| YYYY-MM-DDThh:mm:ss.ms | 2007-11-22T12:30:22.321 |
| YYYY-MM-DDThh:mm:ss+/-< UTC offset > | 2024-02-07T12:30:22-08:00 |

## Geofence set [Copy link to "Geofence set"](https://docs.customer.io/messaging/send/automations/triggers/\#geofence-set)

[Premium This feature is available for Premium plans.](https://docs.customer.io/accounts/billing/plan-features/) [Enterprise This feature is available for Enterprise plans.](https://docs.customer.io/accounts/billing/plan-features/)

You can trigger an automation based on when a person enters, stays in, or exits a [geofence set](https://docs.customer.io/messaging/people/location/geofences/)

[A named group of geofences that you act on together—for example, trigger a campaign when a person enters any geofence in the set. When a person crosses a geofence, our mobile SDKs send a `Geofence Transition` event for each geofence set the geofence belongs to.](https://docs.customer.io/messaging/people/location/geofences/)

to send personalized messages and offers in certain locations. You might use this trigger for parking reminders, nearby EV charger notifications, event or venue engagement, travel hub messaging, and location-based audience engagement.

- **Enters** and **exits** trigger the automation when a person crosses into or out of any geofence in the set. When you choose **exits**, you can also set **Time inside** to **More than** an amount of time, like 20 minutes, to only start the automation for people whose recorded visit lasted longer than that. This only matches exits for users with an [SDK version that supports visit duration](https://docs.customer.io/messaging/people/location/geofence-dwell-time/#visit-duration-on-exit). Learn more about [visit duration](https://docs.customer.io/messaging/people/location/geofence-dwell-time/#visit-duration-on-exit).
![A geofence set trigger for people who exit after more than 20 minutes inside.](https://docs.customer.io/images/geofence-trigger-time-inside.png)
- **[Stays in\**\
**When a person stays inside a geofence for at least the geofence's dwell time, like 10 minutes in a store. Our mobile SDKs send a `Geofence Transition` event with `transition` set to `dwell`, which you can use to trigger automations and build segments.](https://docs.customer.io/messaging/people/location/geofence-dwell-time/)** triggers the automation when a person stays inside a geofence for a minimum amount of time. You set the [dwell time](https://docs.customer.io/messaging/people/location/geofence-dwell-time/) on geofences, not in the automation trigger. Customer.io only starts the automation when a dwell event happened within the last hour, so a dwell event that a device delivers late doesn’t inadvertently start a journey.

![](https://docs.customer.io/images/geofence-trigger.png)

You can also **filter** the audience further by specifying which segments people should or should belong to. For example, maybe you want people to receive a special offer when they enter a geofence (the trigger condition) but haven’t made a purchase recently (a segment filter).

Like with automations triggered by other [events](https://docs.customer.io/messaging/send/automations/triggers/#event-frequency), you can specify a **frequency**—how often a person can re-enter this automation. By default, people enter on every event, which means everytime they meet the trigger conditions for your geofence set. You can also set this to trigger once or once within a time period.

[A geofence transition event](https://docs.customer.io/messaging/people/location/geofence-events/#track-geofence-events) fires when a person enters, stays in, or exits any geofence within a geofence set. However, learn more about the 1-hr long cooldown period.

You can reference the geofence data that triggered the campaign in messages using [the `event` liquid object](https://docs.customer.io/messaging/liquid/tag-list/#event-properties-latest), like you would for other event-triggered campaigns.

## Form submission [Copy link to "Form submission"](https://docs.customer.io/messaging/send/automations/triggers/\#form-trigger)

You can connect forms—Facebook Lead Ads, Jotform, Typeform, your own custom web forms, etc—to your workspace. You can trigger an automation when someone fills out your form. This can help you nurture new leads or respond to support requests.

When you select the **When someone fills out a form on your website** option, you can either connect a new form or select an existing form—if you’ve already added forms to your workspace.

![trigger an automation when people submit a form](https://docs.customer.io/images/form-trigger-settings.png)

**Filters**

You can apply segment-based filters to determine whether someone in the automation should receive messages. For example, if your automation is designed to nurture leads, you might filter out people who have already paid for your services.

### Frequency [Copy link to "Frequency"](https://docs.customer.io/messaging/send/automations/triggers/\#form-frequency)

Much like event-triggered automations, a person enters your automation every time they fill out your form by default. You can limit the automation frequency if you don’t want to send your audience an automation _every_ time they fill out your form.

Toggle frequency to limit how often people move through your automation.

- **Once ever**: people will only enter the automation the first time they fill out your form.
- **Once within a time period**: people can only enter the automation once within a time period, no matter how many times they fill out your form.

## Event [Copy link to "Event"](https://docs.customer.io/messaging/send/automations/triggers/\#event-trigger)

Event-triggered automations help you respond to your audience’s behavior in your app or on your website—like encouraging people to complete their purchase when they abandon your cart, or messaging people who visit a product page on your website to let them know when the product goes on sale. If you want to trigger automations based on geofence events, use the [Geofence set trigger](https://docs.customer.io/messaging/send/automations/triggers/#geofence-set) instead.

When you use this kind of trigger, you can choose the event that you want to use to trigger your automation. If you don’t see the event, you can type the event `name` in the box. If the event occurred recently, click **View <x> instances** to see recent event examples.

You can narrow your trigger criteria based on properties in your event. If you have a particular event attribute you want to use as a filter—like if you only want to target people who bought a specific product—click **Add event data filter** and set the event properties you want to match for your trigger.

![](https://docs.customer.io/images/campaign-event-trigger-filter.png)

You can use JSON dot notation in condition logic

If you store attributes or event data in JSON objects or arrays, you can use JSON dot notation in your branch conditions to evaluate these properties. Use `array[]` to represent any item in an array or `array[0]` to represent the first item in the array. See [Storing and using JSON](https://docs.customer.io/messaging/people/getting-started-with-json/#referencing-json-data-dot-notation) for more information about dot notation in Customer.io.

You can only preview the last 50 events

When you use an event filter, we’ll show you the last 50 occurrences of an event to help you preview people matching your event criteria. This limitation applies only to the preview as you set up your automation. WHen you start your automation, anybody who matches your criteria will still enter in your automation if they match the trigger criteria, regardless of this preview limitation.

### Event triggers preview the latest 50 events [Copy link to "Event triggers preview the latest 50 events"](https://docs.customer.io/messaging/send/automations/triggers/\#event-triggers-preview-the-latest-50-events)

When you use an event filter, we’ll show you the latest 50 occurrences of an event within the last 30 days to help you preview people matching your event criteria. As you add filters, you’ll notice that we’ll show you the total number of events (and people) out of the 50 available preview events that would match your criteria.

This is to help you better understand who would trigger your automation, but it _is not_ an accurate count of people who will trigger your automation!

This 50-event limitation only applies to the preview as you set up your automation. When you start your automation, anybody who matches your criteria will still enter in your automation.

![A trigger preview event that shows you can view 23 instances of events that match your criteria.](https://docs.customer.io/images/trigger-event-50-max.png)

### Frequency [Copy link to "Frequency"](https://docs.customer.io/messaging/send/automations/triggers/\#event-frequency)

By default, a person enters an event-based automation every time they perform the trigger event. You can limit the automation frequency if you don’t want to send your audience an automation _every_ time they perform your event.

Toggle frequency to limit how many times people can move through automations and set your frequency options.

- **One time**: people will only enter the automation the first time they perform the event. For example, if you’d like to congratulate someone the first time they complete a lesson in your eLearning app, you can use this setting. This way, you’ll ensure they don’t receive the email again once they’re a seasoned student and flying through lessons regularly.

- **On every event**: people will enter the automation every time they perform the event.

- **Once within a time period**: people will only enter the automation once within a time period. For example, you want to send an email to someone when they receive notifications in your app. You only want them to receive the email once a day, regardless of how many application notifications they receive. Setting Frequency to “at most once within 24 hours” will ensure that, no matter how many new notifications people get, they will only get an email once.


## Webhook [Copy link to "Webhook"](https://docs.customer.io/messaging/send/automations/triggers/\#webhook-trigger)

Most automations are triggered by people, and people are the subjects of the automation—you set their attributes, send them messages, etc. **Webhook-triggered** automations are different: they’re triggered by data, and data (that may or may not be related to people in your audience) is the subject of the automation.

In general, you’ll use these automations to manipulate incoming data and associate it with people in your audience. For example, if people are interested in a product that’s out of stock, you might use a webhook to notify Customer.io when that item is back in stock. In your automation, you can send an event to everybody who was interested in the product, triggering an automation to let these people know that their product is back in stock!

When you set up an automation and select the **Webhook** option, you’ll get a webhook URL. You’ll provide this URL to the service that you want to collect data from.

![the webhook-triggered automation trigger exposes a webhook URL](https://docs.customer.io/images/data-campaign-trigger.png)

Your automation runs whenevook URL](https://docs.customer.io/images/data-campaign-trigger.png)

Your automation runs whenever this URL is called. The data from your external service can take any shape. You’ll manipulate the data and associate it people as a part of your automation. This lets you perform Zapier-like transformations on your data without having to build an integration.

Right now, you can’t filter or otherwise limit webhook-triggered automation triggers within Customer.io. You’ll have to make sure that your external service is set up to call your webhook-triggered automation’s webhook URL with a relatively uniform data set and only when you want it to call the URL.

Because webhook-triggered automations aren’t associated with people—at least not directly—they don’t have many of the options that you’ll see in other types of automations. They have a much more streamlined workflow: data comes in, you convert it to the format you want, and the automation ends. You won’t set conversion criteria, a frequency, etc.

## Change trigger type [Copy link to "Change trigger type"](https://docs.customer.io/messaging/send/automations/triggers/\#change-trigger-type)

Sometimes you’re building an automation and realize you want people to start a journey based on different criteria. That might mean updating a trigger to include an additional segment or changing the trigger type all together—like moving from an event-triggered automation to a segment-triggered one.

Changing trigger type can impact the rest of your workflow, and you’ll see warnings if the change could cause messages to fail or conditions to not evaluate. For instance, if an email included liquid that pulled in data from your event trigger, like the product a person purchased, then you changed the trigger type, you’ll see a warning calling attention to the email you need to update.

![](https://docs.customer.io/images/change-trigger-type-warning-email.png)

Or if your workflow updates a person’s attributes based on data in the event trigger, you’d see a warning calling attention to that action block.

![](https://docs.customer.io/images/change-trigger-type-warning-action.png)

You’ll also see these warnings in the review modal so you know to address them before you activate your automation.

![](https://docs.customer.io/images/change-trigger-type-review-modal.png)

To change the trigger type, go to your automation’s workflow:

1. Select the trigger block.
2. Click **Change trigger type**.
![](https://docs.customer.io/images/change-trigger-type.png)
3. Select the new trigger type.
4. Fill in the trigger details.

You can only modify the trigger type when the automation is in a `not started` or `stopped` state. This ensures you have time to review and update any workflow items impacted by a change to your trigger.

Was this page helpful?

Updated November 19, 2026

Loading more...