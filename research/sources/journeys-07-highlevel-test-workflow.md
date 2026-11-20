Source: https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow
Title:  Test Workflow : HighLevel Support Portal 
Fetched: 2026-11-20T03:32:01.781Z

All

Articles


## Recent Searches

Clear all

No recent searches

## Popular Articles

* * *

## Articles

[View all](https://help.gohighlevel.com/support/search/solutions)

* * *

## Topics

[View all](https://help.gohighlevel.com/support/search/topics)

* * *

## Tickets

[View all](https://help.gohighlevel.com/support/search/tickets)

![no results](https://help.gohighlevel.com/assets/cdn/portal/images/no-results.png)

Sorry! nothing found for

# Test Workflow

Modified on: Mon, 9 Nov, 2026 at 2:25 AM

Test Workflow lets you test triggers, individual actions, and complete workflows using real account data. Review inputs, outputs, and execution results to identify issues before publishing. You can also revisit previous tests and retry runs from the History tab.

**Table of Contents**

- [Overview](https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow#overview)
- [Key Benefits](https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow#key-benefits)
- [Prerequisites and Getting Started](https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow#prerequisites-and-setup)
- [Ways to Test](https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow#ways-to-test)
- [Test a Trigger](https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow#test-a-trigger)
- [Test an Action](https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow#test-an-action)
- [Test the Whole Workflow](https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow#test-the-whole-workflow)
- [Review History and Retry a Run](https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow#review-history-and-retry-a-run)
- [Run and Step Statuses](https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow#run-and-step-statuses)
- [Things to Know](https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow#things-to-know)
- [Use Case](https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow#use-case)
- [FAQs](https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow#faqs)
- [Related Articles](https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow#related-articles)

* * *

# **Overview**

Test Workflow lets you check a workflow before it goes live. You can test a single trigger with a real event from your account, test a single action with that event’s data, or run the whole workflow step by step and watch each step pass or fail.

Every test runs the real steps, so when a test works, you know the workflow works.

* * *

## **Key Benefits**

- **Real data:** test with real events from your own account, not made-up values.

- **One step at a time:** test a trigger or a single action without running the whole workflow.

- **Live progress:** watch each step of a whole-workflow test run on the canvas.

- **Faster debugging:** open any step to see its input and output, and retry a run in one click.

- **Confidence to publish:** go live knowing every step has already worked.


* * *

## **Prerequisites and Getting Started**

The new Test Workflow experience is available through HighLevel Labs under **The New Test Workflow**. Enable the feature before testing workflow triggers and actions. Labs activation controls can differ depending on whether the feature is offered at the agency or sub-account level.

1. From **Agency View**, open **Settings > Labs**.

2. Find **The New Test Workflow** feature card in the applicable Labs tab.

3. Use the controls available on the feature card to enable it for the intended sub-account. If **Manage** is shown, select the appropriate sub-account and save your changes. Confirm the feature is enabled before proceeding.

4. Switch to **Sub-Account View** for the sub-account you want to test.

5. Go to **Automation > Workflows**.

6. Open the workflow you want to test.


You can test a trigger, test an individual action, or run the entire workflow from the builder.

**Important:** Tests execute real actions. Use test data to avoid sending unintended messages or changing customer records.

* * *

## **Ways to Test**

The Test tab on a trigger, and the Test workflow panel, offer two ways to test.

| **Option** | **What it does** | **Use it when** |
| --- | --- | --- |
| **Test using events** | Select an existing recorded event, or turn on **Listen for events** to capture a new one. Listening lasts 15 minutes. | You can fire the trigger yourself, for example by submitting the form. |
| **Enroll a contact** | Runs the test for a contact you pick, as if the trigger fired for them. | Firing a real event is not practical. |

* * *

## **Test a Trigger**

This example tests a Form Submitted trigger with a real form submission.

### **Step 1:** Open the Test tab

Click the trigger on the canvas. In the panel that opens, click the Test tab next to Setup. Choose Test using events.

![The Test tab on a Form Submitted trigger](https://s3.amazonaws.com/cdn.freshdesk.com/data/helpdesk/attachments/production/155083699859/original/-HgLokCLFgT3YSGxZK3OW5GruYN2C2YCnw.png?1792438853)

_The Test tab on a Form Submitted trigger_

### **Step 2:** Switch on Listen for events

Turn on the Listen for events toggle. The panel shows how much listening time is left and how many events were recorded.

![Listening for events, with the time left and the events recorded](https://s3.amazonaws.com/cdn.freshdesk.com/data/helpdesk/attachments/production/155083699860/original/gnbKXy4krdvtyXZjV9ZkrWt1XBSGzUhnVA.png?1792438859)

_Listening for events, with the time left and the events recorded_

### **Step 3:** Fire the trigger

Do the thing that fires the trigger. For Form Submitted, open the form and submit it. The event appears in the panel within seconds.

Select the event under Select event. Event data lists every field it carries, including the form fields and the contact details.

![A recorded event and its event data](https://s3.amazonaws.com/cdn.freshdesk.com/data/helpdesk/attachments/production/155085234526/original/Eqbw3QV-p_iW46Stnr9S9RRJkocEL5Q5xg.png?1794212344)

_A recorded event and its event data_

### **Step 4:** Click Test Trigger

Click Test Trigger. When the test passes, the panel shows Trigger tested and the event is pinned. The pinned event provides input data for testing individual actions later in the workflow.

![Trigger tested, with the pinned event as output](https://s3.amazonaws.com/cdn.freshdesk.com/data/helpdesk/attachments/production/155085234571/original/-dur8jF9H3n0c56S3U9H4v49tsr6JtcdAw.png?1794212365)

_Trigger tested, with the pinned event as output_

**Note:** Click Retest at any time to test the trigger again with a different event.

* * *

## **Test an Action**

### **Before you begin:** Test the workflow trigger first and select an event using **Test Trigger**. This pins the event data so the action can use it during its test.

### **Step 1:** Review the setup

Click the action on the canvas. On the Setup tab, check its fields. Fields that use custom values, such as Contact Full Name, are filled from the pinned event during the test.

### **Step 2:** Run the test

Open the Test tab. Input lists the values the action will use, built from the pinned event. Click Test action.

![The action’s input, filled from the pinned event](https://s3.amazonaws.com/cdn.freshdesk.com/data/helpdesk/attachments/production/155083699865/original/6xZWh1-HCfE3s2bLOuuHPbU63sQpCYEkqQ.png?1792438874)

_The action’s input, filled from the pinned event_

### **Step 3:** Check the output

When the test passes, the panel shows Action tested. Switch to Output to see the result, for example Success, the message and the new record’s ID. These fields are now available to later steps.

![Action tested, with the output of Create Opportunity](https://s3.amazonaws.com/cdn.freshdesk.com/data/helpdesk/attachments/production/155083699869/original/Xog3i_ETN1IKuSRNxiL3wCZaWaE58_gfMQ.png?1792438879)

_Action tested, with the output of Create Opportunity_

**Note:** The action runs for real. In this example, the test creates a real opportunity in the pipeline.

* * *

### **Test the Whole Workflow**

### **Step 1:** Open Test workflow

Click Test workflow in the top right of the builder. The Test workflow panel opens on the New test tab.

### **Step 2:** Pick the trigger and the event

Choose Test using events or Enroll a contact. Under Select Trigger, pick the trigger to run. Under Select event, pick the event to test with, or switch on Listen for events to record a new one. Check the event data, then click Start test run.

![The Test workflow panel with the trigger and event selected](https://s3.amazonaws.com/cdn.freshdesk.com/data/helpdesk/attachments/production/155085234596/original/xvRODQ-3XLMh86F2OsxeSRORVUmokO08Zg.png?1794212394)

_The Test workflow panel with the trigger and event selected_

### **Step 3:** Watch the run

The workflow runs action by action. Each step on the canvas shows its status as it finishes, and the History tab shows the run as Test running.

![A test run in progress: finished steps show Success and the current step shows Running](https://s3.amazonaws.com/cdn.freshdesk.com/data/helpdesk/attachments/production/155083699879/original/uVlUPzbTmlmIMY9rTzI75oBBEM2WDVXFjw.png?1792438908)

_A test run in progress: finished steps show Success and the current step shows Running_

### **Step 4:** Review the result

When the run ends, the canvas shows the result of every step and History shows the final status, such as Completed with skipped steps. The canvas is read only while you view a run.

![A finished run: every step’s status on the canvas and the run in History](https://s3.amazonaws.com/cdn.freshdesk.com/data/helpdesk/attachments/production/155083699887/original/8O7VyhkhnTNjD4pp6oIB0P1uUrsbDQ0vBg.png?1792438915)

_A finished run: every step’s status on the canvas and the run in History_

Click any step to open its Input and Output. Use this to find the step that caused a problem.

![The output of one step from a test run](https://s3.amazonaws.com/cdn.freshdesk.com/data/helpdesk/attachments/production/155083699889/original/9V8zX0gtOdjGEJNkXN7HKfB6mhSs82RCUQ.png?1792438922)

_The output of one step from a test run_

After reviewing the results and confirming that the expected steps succeeded, save the workflow. When you are ready for live execution, set the workflow status to **Publish**.

**Note:** Testing is optional. You can save and publish a workflow without running a test.

* * *

## **Review History and Retry a Run**

Open the History tab in the Test workflow panel to see every test run. Filter the list by All, Success, Failed or Skipped.

![The History tab with a past test run](https://s3.amazonaws.com/cdn.freshdesk.com/data/helpdesk/attachments/production/155083699966/original/OILvWfAo7AdU1X3r3vpYNksw5WvvY5f5xw.png?1792439010)

_The History tab with a past test run_

To run the same test again, hover over a run and click Retry run. The retry uses the same trigger data and action configuration, and appears in History as a new run.

![Retry run on a past test run](https://s3.amazonaws.com/cdn.freshdesk.com/data/helpdesk/attachments/production/155083699970/original/2wsA1VfJWWSsYBsIZ5_hn6lgso5SLx41tA.png?1792439016)

_Retry run on a past test run_

* * *

## **Run and Step Statuses**

| **Status** | **Meaning** |
| --- | --- |
| **Test running** | The run is in progress. History shows the step that is running now. |
| **Success** | The step ran and finished without errors. |
| **Failed** | The step ran and returned an error. Open the step to see the error in its output. |
| **Action skipped** | The step did not run in this test run. |
| **Completed with skipped steps** | The run finished, and one or more steps were skipped. |

* * *

## **Things to Know**

- **Tests are real.** Messages are sent, and records are created or changed.

- **Testing is optional.** You can save and publish without testing.

- **The pinned event stays** until you retest the trigger with another event.

- **Listening lasts 15 minutes.** Switch it on again if your event did not arrive in time.


* * *

## **Use Case**

**Scenario:** A video agency builds a workflow for its Video Production and Editing Request form. When someone submits the form, the workflow creates an opportunity, sends a welcome email, adds a High Priority tag and creates a follow-up task.

The builder switches on Listen for events on the trigger, submits the form with their own details and tests the trigger with that event. They test Create Opportunity, check that the opportunity appears in the pipeline with the right name, then click Test workflow and run every step on a second event. The run shows each step’s result, so they publish the workflow knowing it works.

* * *

## **FAQs**

**Q: Does a test send real emails or create real records?**

Yes. Every test runs the real action. A test of Send Email sends the email, and a test of Create Opportunity creates the opportunity. Test with your own details or a test form entry when you don’t want to reach a customer.

**Q: What if no event arrives while I’m listening?**

Listening records events for 15 minutes. If nothing arrives, switch on Listen for events again and fire the trigger once more, for example by submitting the form.

**Q: Can I test a trigger without firing a real event?**

Yes. Choose Enroll a contact on the Test tab. The test runs for the contact you pick, as if the trigger fired for them.

**Q: Do I need to test the trigger before I test an action?**

Yes. An action test uses the data of the event pinned by the trigger test. Test the trigger first, then test the actions below it.

**Q: Do I have to test every step before I publish?**

No. Testing is optional. You can save and publish a workflow without running any test.

**Q: Where can I see a test I ran earlier?**

Click Test workflow and open the History tab. Every run is listed with its status, and you can filter by Success, Failed or Skipped.

**Q: What does Retry run use?**

Retry run repeats a test using the same trigger data and action configuration. The retry appears as a new entry in the History tab.

* * *

### **Related Articles**

- [Labs Features - Complete Overview](https://help.gohighlevel.com/support/solutions/articles/155000003588-labs-features-complete-overview)
- [Getting Started with Workflows](https://help.gohighlevel.com/support/solutions/articles/155000002288)

## Was this article helpful?

No
Yes


That’s Great!

Thank you for your feedback

Sorry! We couldn't be helpful

Thank you for your feedback

Your e-mail address

\*

Let us know how can we improve this article!\*

Need more information



Difficult to understand



Inaccurate/irrelevant content



Missing/broken link



Select at least one of the reasons


Please give your comments



CAPTCHA verification is required.


Cancel


Send


Feedback sent

We appreciate your effort and will try to fix the article

![Article views count](https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow/hit)