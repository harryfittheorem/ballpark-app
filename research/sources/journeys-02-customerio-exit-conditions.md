Source: https://docs.customer.io/journeys/campaign-exit-conditions/
Title: Automation exit conditions - Customer.io Documentation
Fetched: 2026-11-20T03:31:39.584Z

50

# Automation exit conditions

Copy pageCopy page

Copy pageCopyCopy linkCopy link[View MarkdownMarkdown](https://docs.customer.io/messaging/send/automations/exit-conditions.md)Ask your LLMAsk LLM

Exit conditions determine if or when a person should exit your automation. The options available depend on the type of automation trigger you use—attribute or segment, event, etc.

## How it works [Copy link to "How it works"](https://docs.customer.io/messaging/send/automations/exit-conditions/\#how-it-works)

**By default, a person continues through an automation until they stop matching the automation’s trigger or filter conditions.**

In this example, the automation sends students a form to evaluate their tutors. The automation is triggered by an event `course_complete` and filters out people who were absent from more than five classes.

![](https://docs.customer.io/images/campaign-event-filter.png)

By default, a person exits when they stop matching the filters.

![](https://docs.customer.io/images/campaign-exit-criteria-default.png)

So in this automation, a student would exit if an admin increases the student’s absentee count such that they are now IN the absentee filter segment.

Learn more about the [filter conditions available for each automation trigger type](https://docs.customer.io/messaging/send/automations/triggers-and-filters/#types-of-filters).

## Manage exit criteria [Copy link to "Manage exit criteria"](https://docs.customer.io/messaging/send/automations/exit-conditions/\#manage-exit-criteria)

To view or modify your exit criteria, go to your automation’s workflow, click , and select **Exit conditions**.

![](https://docs.customer.io/images/campaign-exit-criteria-default.png)

### Set your own exit criteria [Copy link to "Set your own exit criteria"](https://docs.customer.io/messaging/send/automations/exit-conditions/\#set-your-own-exit-criteria)

To set conditions that end journeys early, click **Edit conditions**. If you removed every exit condition, the button reads **Add conditions** instead.

![](https://docs.customer.io/images/campaign-exit-criteria-add.png)

Then choose one or more conditions. Exit criteria are OR statements; people exit when they meet any condition in your exit criteria.

- **Profile attributes**: make people exit when their profiles meet certain criteria
- **Events**: make people exit when they have or have not performed certain events
- **Segments**: make people exit when they’re a member or not a member of certain segments
- **[Geofence set\**\
**A named group of geofences that you act on together—for example, trigger a campaign when a person enters any geofence in the set. When a person crosses a geofence, our mobile SDKs send a `Geofence Transition` event for each geofence set the geofence belongs to.](https://docs.customer.io/messaging/people/location/geofences/)**: make people exit when they enter, stay in, or exit a certain geofence set
- **Object (Trigger)**: make people exit when they meet conditions related to objects or relationships. Only available when using an [object trigger](https://docs.customer.io/messaging/send/automations/object-triggers/).

### Remove exit criteria [Copy link to "Remove exit criteria"](https://docs.customer.io/messaging/send/automations/exit-conditions/\#remove-exit-criteria)

By default, a person continues through an automation until they stop matching the automation’s trigger or filter conditions.

To remove this and other criteria, click  beside the condition.

![](https://docs.customer.io/images/campaign-exit-criteria-remove.png)

If people should always finish the automation, remove all exit conditions.

Was this page helpful?

Updated November 2, 2026

Loading more...