Source: https://knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines
Title: Set up and manage object pipelines
Fetched: 2026-11-20T03:31:59.315Z

[Skip to content](https://knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines#kb-main-content)

Home

[![HubSpot](https://knowledge.hubspot.com/hubfs/HubSpot_Logos/HubSpot_Logo_Primary.svg)\\
Knowledge Base](https://knowledge.hubspot.com/?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=kb--header-nav-logo-link)

Menu

- [Help Center](https://help.hubspot.com/)
- Documentation




  - [Knowledge BaseSetup, how-to, and troubleshooting guides](https://knowledge.hubspot.com/?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=kb--header-nav-child-link)
  - [Developer DocumentationReference for API & CMS development](https://developers.hubspot.com/)

- Training




  - [Academy Content LibraryA complete library of Academy’s free online video lessons and certification courses.](https://academy.hubspot.com/courses)
  - [Academy Certification CoursesA collection of lessons and practical exercises leading to an industry-recognized certification in HubSpot’s tools or strategy.](https://academy.hubspot.com/certification-overview)
  - [Classroom TrainingSchedule in-person training for a hands-on and personalized HubSpot training experience.](https://www.hubspot.com/services/premium-support)

- Community




  - [CRM & Sales HubAsk and answer questions about using HubSpot’s CRM and Sales Hub.](https://community.hubspot.com/c/crm-sales-hub/52)
  - [Marketing HubDiscuss and learn HubSpot’s marketing tools and inbound strategy.](https://community.hubspot.com/c/marketing-content/61)
  - [Service HubLearn about Service Hub and share your expertise.](https://community.hubspot.com/c/customer-success-service/55)
  - [Meet the ExpertsLearn how to get the most out of HubSpot from those who know it best.](https://community.hubspot.com/leaderboard/4)
  - [Submit IdeasSearch, vote for, and submit ideas to improve the HubSpot platform.](https://community.hubspot.com/c/hubspot-ideas/59)
  - [HubSpot DevelopersAsk questions and connect with users building on HubSpot.](https://community.hubspot.com/c/develop-build-integrate/58)
  - [HubSpot User GroupsMeet regularly with your local community of HubSpot users.](https://academy.hubspot.com/hubspot-user-groups)

- Blogs




  - [HubSpot BlogMarketing, sales, agency, and customer success blog content.](https://blog.hubspot.com/?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=kb--header-nav-child-link)
  - [Customer BlogExamples of how real customers use HubSpot for their business.](https://blog.hubspot.com/customers?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=kb--header-nav-child-link)
  - [Product Updates BlogUpdates on the latest releases from HubSpot’s Product team.](https://www.hubspot.com/product-updates)

- [Get a demo](https://offers.hubspot.com/crm-platform-demo?hubs_signup-url=knowledge.hubspot.com&hubs_signup-cta=kb) [Get started free](https://app.hubspot.com/signup-hubspot/crm?hubs_signup-url=https%3A%2F%2Fknowledge.hubspot.com&hubs_signup-cta=kb-nav&step=existing_user)

- [Knowledge Base](https://knowledge.hubspot.com/?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=cl-breadcrumbs-link-text)
- [CRM](https://knowledge.hubspot.com/crm?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=cl-breadcrumbs-link-text)
- [Object Settings](https://knowledge.hubspot.com/crm/topics?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=cl-breadcrumbs-link-text#object-settings)
- Set up and manage object pipelines

# Set up and manage object pipelines

Last updated:



November 17, 2026

#### Available with any of the following [subscriptions](https://knowledge.hubspot.com/billing/where-can-i-find-my-subscription-and-contacts-or-email-send-limit-information-in-hubspot?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=subscriptions), except where noted:

- ![](https://knowledge.hubspot.com/hubfs/Knowledge_Base/subscription_key_icons/sprocket-web-color.svg)[All products and plans](https://www.hubspot.com/products/crm?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=all-products-and-plans)

- ![](https://knowledge.hubspot.com/hubfs/Knowledge_Base/subscription_key_icons/cl_information_icon.svg)[Additional subscriptions](https://legal.hubspot.com/hubspot-product-and-services-catalog) required for certain features

Pipelines help visualize your processes through stages, which are steps that signal where a record is in a process. For example, create deal pipelines to track revenue, ticket pipelines to track customer issues, or listing pipelines to track for-sale properties.

Learn more about building custom solutions using the [Pipelines API](https://developers.hubspot.com/docs/api-reference/latest/crm/pipelines/guide).

**Please note:** your account may use [personalized names for each object](https://knowledge.hubspot.com/object-settings/rename-objects?hubs_content=knowledge.hubspot.com/records/manage-index-page-types-and-tabs-beta&hubs_content-cta=personalized-names-for-each-object) (e.g., account instead of company). This article refers to objects by their HubSpot default names.

## Before you get started

Subscription required

- A _Professional_ or _Enterprise_ subscription is required to manage lead object pipelines _._
- An _Enterprise_ subscription is required to manage custom object pipelines.

Permissions required [Edit property settings](https://knowledge.hubspot.com/user-management/hubspot-user-permissions-guide?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=edit-property-settings#account) permissions are required to create and edit pipelines or stages.

The following objects have pipelines:

- Appointments (if [activated](https://knowledge.hubspot.com/data-management/manage-your-data-model?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=activated))
- Courses (if [activated](https://knowledge.hubspot.com/data-management/manage-your-data-model?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=activated))
- Custom objects
- Deals
- Leads
- Listings (if [activated](https://knowledge.hubspot.com/data-management/manage-your-data-model?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=activated))
- Orders
- Projects (if [activated](https://knowledge.hubspot.com/records/understand-and-use-projects-object?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=activated))
- Services (if [activated](https://knowledge.hubspot.com/data-management/manage-your-data-model?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=activated))
- Tasks
- Tickets
- Users

Tasks only have the one default pipeline without conditional stage logic. Once you've set up pipelines, learn how to [manage your records in board view](https://knowledge.hubspot.com/records/manage-records-in-board-view?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=manage-your-records-in-board-view).

## Understand your pipeline limits

The number of custom pipelines available is shared across all objects and excludes the HubSpot default pipeline for each object. All hubs can access pipelines for all object types. For more information about subscription limits and tiers, see the [Pricing and Packaging](https://www.hubspot.com/pricing/marketing?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=pricing-and-packaging) page.

The number of custom pipelines available depends on your subscription:

- **Free tools**: 0 custom pipelines.
- **Starter**: 15 custom pipelines.
- **Professional**: 100 custom pipelines.
- **Enterprise**: 350 custom pipelines.

To review your custom pipeline usage:

1. In your HubSpot account, click **More**, then navigate to [**Data Management** \> **Data Model**](https://app.hubspot.com/l/data-model-intro?hubs_signup-url=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_signup-cta=data-management-data-model). If _More_ doesn't appear in your account, navigate to [**Data Management** \> **Data Model**](https://app.hubspot.com/l/data-model-intro?hubs_signup-url=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_signup-cta=data-management-data-model) directly.

2. Click the **Limits** tab.
3. In the _Definition Limits_ section, click **Pipelines**.
4. In the table, review the number of custom pipelines per object.
5. Hover over an object and click **View pipeline settings** to [edit or delete pipelines](https://knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines#edit-or-delete-pipelines).

## Create a new pipeline

Subscription required

- A _Starter_, _Professional_ or _Enterprise_ subscription is required to create a custom pipeline.
- A _Professional_ or _Enterprise_ subscription is required to restrict a pipeline by team.

If your account has more than one unique process, you can create additional pipelines. Separate pipelines are only recommended if your processes have unique stages that require different pipelines. Otherwise, you can use the same pipeline across multiple users and teams and manage access via user permissions. For example:

- Your business has an online direct to consumer sales process with a few stages, such as _In cart_, _Closed Won_, and _Closed Lost_. You also have a wholesale sales process that requires more stages, such as appointment scheduling and contract negotiation. In this scenario, you should create separate pipelines.
- Your business sells multiple brands and your HubSpot account has teams for each brand. The process to sell products for each brand is the same and you can use the same stages for all sales. In this scenario, it's not recommended to create separate pipelines. Instead, you can use the same pipeline and [set Team only user permissions](https://knowledge.hubspot.com/records/assign-access-to-records?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=set-team-only-user-permissions#assign-access-to-records-by-team-professional-and-enterprise-only) so each team can only access their brand's deals.

**Please note:**

- Leads in a custom pipeline aren't eligible for default lead stage automation.
- Learn more about the [maximum number of pipelines](https://legal.hubspot.com/hubspot-product-and-services-catalog#Sales) you can create depending on your subscription.

To create a new pipeline:

1. In your HubSpot account, click the [**settings icon**](https://app.hubspot.com/l/settings/user-preferences/profile?hubs_signup-url=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_signup-cta=settings-icon) in the top navigation bar.
2. In the left sidebar menu, in the _Data Management_ section, click **Objects**.
3. On the _Objects_ page, click the **Select an object** dropdown menu and select the **object** for which you want to create a pipeline.
4. Click the **Pipelines** tab.
5. Click the **Create pipeline** dropdown menu and select **Create from scratch**.
6. In the dialog box, enter a **Pipeline** **name** and click **Create**.

Once you've added records to your pipeline, learn how to [edit the records in a pipeline](https://knowledge.hubspot.com/records/bulk-edit-records?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=edit-the-records-in-a-pipeline).

You can also use [Breeze Assistant](https://knowledge.hubspot.com/ai/use-breeze-assistant?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=breeze-assistant) to create an object pipeline.

## Clone a pipeline

Subscription required

A _Professional_ or _Enterprise_ subscription is required to clone a pipeline.

You can clone an existing pipeline to copy over information such as pipeline rules, automations, and conditional stage properties.

1. In your HubSpot account, click the [**settings icon**](https://app.hubspot.com/l/settings/user-preferences/profile?hubs_signup-url=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_signup-cta=settings-icon) in the top navigation bar.
2. In the left sidebar menu, in the _Data Management_ section, click **Objects**.
3. On the _Objects_ page, click the **Select an object** dropdown menu and select the **object** for which you want to clone a pipeline.
4. Click the **Pipelines** tab.
5. Click the **Create pipeline** dropdown menu and select **Clone from existing**.
6. In the dialog box, configure the following:
   - **Pipeline name**: in the _Pipeline name_ text field, enter a **name** for the cloned pipeline.
   - **Pipeline to clone**: click the **Select pipeline to clone** dropdown menu and select a **pipeline**.
   - **Features to clone**: in the _Choose features to clone_ section, select the **checkboxes** next to the features you want to clone.

     - Conditional stage properties
     - Pipeline rules (control editing access, require approval)

  - Pipeline automations (templated and custom)
  - Deal tags
  - Pipeline access

- When you're finished, click **Clone pipeline**.

You can also use [Breeze Assistant](https://knowledge.hubspot.com/ai/use-breeze-assistant?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=breeze-assistant) to clone an existing object pipeline.

## Edit or delete pipelines

Subscription required

A _Starter_, _Professional_ or _Enterprise_ subscription is required to use object tags.

**Please note:** if you connect an e-commerce integration to HubSpot, a deal pipeline will be automatically added to your account that you cannot modify.

You can also rename, reorder, manage access to, or delete pipelines.

01. In your HubSpot account, click the [**settings icon**](https://app.hubspot.com/l/settings/user-preferences/profile?hubs_signup-url=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_signup-cta=settings-icon) in the top navigation bar.
02. In the left sidebar menu, in the _Data Management_ section, click **Objects**.
03. On the _Objects_ page, click the **Select an object** dropdown menu and select the **object** for which you want to edit a pipeline.
04. Click the **Pipelines** tab.
05. In the _Set pipeline display colors_ section, select a **color option** for the _Pipeline_ property. The selected option applies to all pipelines of the object.
06. Hover on a pipeline in the table and click the color selector **button**, then select a **color** for the pipeline.
07. Click the **name** of a pipeline you want to edit.
08. Click the code code icon to view the pipeline's internal name. The internal name is used by integrations and [APIs](https://developers.hubspot.com/docs/api-reference/legacy/crm/owners/guide).
09. On the right, click **Actions**, then select one of the following:


    - **Rename this pipeline**: change the pipeline’s name. In the dialog box, enter the new **name**, then click **Rename**.
    - **Reorder pipelines**: change the order of your pipelines. In the pop-up box, drag the **pipelines** to move them to a new position, then click **Save**.
    - [**Manage access**](https://knowledge.hubspot.com/account-security/limit-access-to-your-hubspot-assets?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=manage-access#object-pipelines): manage which users can view and edit the pipeline.
    - **Clone this pipeline**: create a new pipeline using the selected pipeline as a template.
    - **Delete this pipeline**: delete the pipeline. In the dialog box, click **Delete pipeline** to confirm. You can't delete a pipeline if it contains records or is used in other HubSpot tools or integrations. Before deleting, you'll need to delete or move records to another pipeline and remove references to the pipeline from other tools.
10. Click **Customize board and card view** to [select the properties that are displayed on the board and board cards](https://knowledge.hubspot.com/object-settings/select-properties-to-show-on-records-in-board-view?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=select-the-properties-that-are-displayed-on-the-board-and-board-cards) for the pipeline.
11. Click the **Automate** tab to customize [automation settings](https://knowledge.hubspot.com/object-settings/set-up-pipeline-automations-for-objects?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=automation-settings) for a pipeline.
12. Click **Customize \[object\] tags** to create and manage [color-coded labels](https://knowledge.hubspot.com/object-settings/color-coded-object-tags?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=color-coded-labels) that categorize records.
13. Click the **Pipeline Rules** tab to set up [rules](https://knowledge.hubspot.com/object-settings/set-up-pipeline-rules?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=rules) for a pipeline.

## Manage stages in a pipeline

Use stages to categorize and track the progress of your records through pipelines.

### Default pipeline stages

Depending on the object, there is a default pipeline with default stages:

- **Appointments**: a default appointment pipeline with five stages: _Scheduled_, _In Progress_, _Completed_, _Canceled_, _Rescheduled_.
- **Courses**: a default course pipeline with an _Open Stage_ and a _Closed Stage_.
- **Deals**: a default Sales Pipeline for which each stage has an associated probability that indicates the likelihood of closing deals in that stage. Stage probability is used to determine the weighted amount shown in board view, which is calculated by multiplying the total amount in each stage by the stage probability. The default pipeline has seven deal stages: _Appointment scheduled_ (20%), _Qualified to buy_ (40%), _Presentation_ _scheduled_ (60%), _Decision maker bought-in_ (80%), _Contract sent_ (90%), _Closed won_ (100%, Won), _Closed lost_ (0%, Lost).
- **Leads**: a default Lead pipeline with five lead stages: _New_, _Attempting_, _Connected_, _Qualified_, _Disqualified_.
- **Listings**: a default listing pipeline with an _Open Stage_ and a _Closed Stage_.
- **Orders**: a default new order pipeline with two stages: _In Progress_, _Contract Signed_.
- **Projects**: a default project pipeline with six stages: _Planning_, _Execution_, _Review_, _Completed_, _On Hold_, _Cancelled_.
- **Services**: a default service pipeline with three stages: _New_, _In Progress_, _Closed_.
- **Tasks**: a default task pipeline with five stages: _Not Started_, _In Progress_, _Waiting_, _Completed_, _Deferred_.
- **Tickets**: a default Support Pipeline with four ticket statuses: _New_, _Waiting on contact_, _Waiting on us_, _Closed_.

**Please note:** for tickets, pipeline stages are called statuses by default, but they are the same as other object stages.

### Add, edit, or delete pipeline stages

You can also add your own stages or edit and delete existing stages. To customize the stages in a pipeline:

1. In your HubSpot account, click the [**settings icon**](https://app.hubspot.com/l/settings/user-preferences/profile?hubs_signup-url=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_signup-cta=settings-icon) in the top navigation bar.
2. In the left sidebar menu, in the _Data Management_ section, click **Objects**.
3. On the _Objects_ page, click the **Select an object** dropdown menu and select the **object** for which you want to edit pipeline stages.
4. Click the **Pipelines** tab.
5. Click the **name** of the pipeline you want to edit.
6. To add a new stage:


   - Under the existing stages, click **\+ Add stage**.
   - Enter a **stage name**.
   - For all objects except deals, select whether the stage will be **Open** or **Closed**.
   - For deals, click the **Deal** **probability** dropdown menu and select a **probability**. To use a custom probability, enter a custom **value**, then click **Add option** and select the new **probability**. Won and Lost are closed stages.

![A gif displaying the steps to create a deal stage, set the probability, and reorder the stage in the pipeline.](https://knowledge.hubspot.com/hs-fs/hubfs/Knowledge_Base_2023-24-25/KB-Object-settings/Inbound%202025%20Screenshot%20Updates/Set%20up%20and%20manage%20object%20pipelines/object-settings-add-deal-stage.gif?width=700&height=384&name=object-settings-add-deal-stage.gif)

**Please note:** for deals, to ensure all sales reports, custom deal or revenue reports, and sales analytics tools process your deals correctly, you must include stages for both Won and Lost under Deal probability.

6. To add color indicators per pipeline stage:
   - In the _Color_ column, click the **color button** and select a **color**.
   - If desired, set a color for each stage in the pipeline.
7.  Click the stage's **name**, then enter a new **name** in the text box to change the name of an existing stage.
8. Click the **stage** and drag it to a new position to reorder it in the pipeline.
9. Hover over the stage and click the code **internal name icon**. The internal name is used by integrations and [APIs](https://developers.hubspot.com/docs/api-reference/legacy/crm/property-validations/guide).
10. To delete a stage:
   - Navigate to the _Used in_ column in the table, then click the number to review and remove delete blocking references (e.g., records in the stage, conditional properties in use).
   - Navigate to the _Delete_ column in the table, then click the delete **delete stage icon**.

11. Hover over the _Conditional stage properties_ column and click **Edit properties** to edit the [properties shown when a record moves to a certain stage](https://knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines#customize-properties-shown-in-each-stage).
12. Once you're done editing, click **Save** in the bottom left.

You can also use [Breeze Assistant](https://knowledge.hubspot.com/ai/use-breeze-assistant?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=breeze-assistant) to add, update, or remove pipeline stages.

**Please note:** Breeze Assistant cannot create or update pipeline rules, object tags, or automations, and cannot make changes to contact or company lifecycle stages.

### Set up conditional stage properties

Permissions required [Edit property settings](https://knowledge.hubspot.com/user-management/hubspot-user-permissions-guide?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=edit-property-settings#account) permissions are required to set up conditional stage properties.

Set up conditional stage logic to show certain properties when users manually create a record in or move a record to a specific stage. This can help you organize and maintain data in your pipelines. Ensure the dependent property exists prior to configuring conditional stage logic.

1. In your HubSpot account, click the [**settings icon**](https://app.hubspot.com/l/settings/user-preferences/profile?hubs_signup-url=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_signup-cta=settings-icon) in the top navigation bar.
2. In the left sidebar menu, in the _Data Management_ section, click **Objects**.
3. On the _Objects_ page, click the **Select an object** dropdown menu and select the **object** for which you want to edit conditional stage properties.
4. Click the **Pipelines** tab.
5. Click the **name** of the pipeline you want to edit.
6. In the row of a stage, hover over the _Conditional logic rules_ column and click **Add rule**.
7. In the pipeline property logic editor, configure the following:
   - Click the **operator** dropdown menu, then select an **operator** (e.g., is equal to, is none of, is known).
   - Click the **\[object\] stage** dropdown menu, then select **additional stages** if you selected _is any of_ or _is none of_ operators.
   - In the _Dependent properties_ section, click **Add property**, then select the **property**.

**Please note:** properties with read-only values (i.e. that aren't set by users, such as score or calculation properties) cannot be used as stage properties, and will not appear as options to select. Learn how to [include these properties in a properties section on a record instead](https://knowledge.hubspot.com/object-settings/customize-properties-in-record-sections?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=include-these-properties-in-a-properties-section-on-a-record-instead).

- Select the **Required** checkbox to require a property. If a property is required, users cannot create or update the record until they set a value for it.
- Click and drag a **property** to reorder it, if you added multiple dependent properties. The properties will be displayed in this order when they appear in the create record form or when editing a record.
- In the upper right, click **Save logic**. The properties you've selected will automatically appear when manually creating a new record in that stage or when moving an existing record to that stage.

![Property logic editor showing Pipeline Stage set to “is any of,” with dependent property marked required and preview of required field.](https://knowledge.hubspot.com/hs-fs/hubfs/Knowledge_Base_2023-24-25/KB-Object-settings/Pipeline%20settings/set-up-conditional-stage-properties.png?width=800&height=441&name=set-up-conditional-stage-properties.png)

Learn more about [editing existing conditional logic](https://knowledge.hubspot.com/properties/set-up-conditional-logic-for-enumeration-properties?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=editing-existing-conditional-logic#edit-or-delete-existing-conditional-logic) or [adding secondary logic](https://knowledge.hubspot.com/properties/set-up-conditional-logic-for-enumeration-properties?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=adding-secondary-logic) for a pipeline stage.

CRMObject Settings

![](https://knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines)

Was this article helpful?YesNo

Thanks for letting us know. How would you describe this article?


Inaccurate: it doesn’t reflect what I see in the product



Unclear: it’s difficult to understand



Missing information: it’s not comprehensive enough



Irrelevant: it doesn’t match what I searched for


Great! Is there anything we could change to make it even more helpful?Is there anything we could change to make this article helpful?

Allow HubSpot to contact me about my documentation feedback.


Email address

Only used if we need clarification on your feedback.

Thank you for your feedback, it means a lot to us.

This form is used for documentation feedback only. Learn how to [get help with HubSpot](https://knowledge.hubspot.com/account/get-help-with-hubspot?hubs_content=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_content-cta=get-help-with-hubspot).

Table of contents/object-settings/set-up-and-customize-pipelines Menu

#### Related content

[![New to HubSpot? Use these guides to get started.](https://www.hubspot.com/hs-fs/hubfs/English.svg?height=99&width=353)](https://knowledge.hubspot.com/cs/c/?cta_guid=f371c0e2-3d73-498e-9582-1837ee45e7b1&signature=AAH58kGngpii5GAlN7mpnpMG_3v0sfflGw&portal_id=53&pageId=5977309203&placement_guid=21472a0f-6f98-4d81-907c-6ac264c03136&click=582ba768-ece4-4e58-809c-0c111aa5241c&redirect_url=APefjpGLdV9TdQcmG5ghSWlgtsACldM_YSah-af3jdeELrNo2LbxU6yPlDgRi6sDu9A0R3j8Eu6VEx5a8wE2V2OKf8rLFvBQ_6Hq9Y0mO7HC9Qr5WfEQo28ZKDPbAo8xW-Ci0aVp4Hlu&hsutk=&canon=https%3A%2F%2Fknowledge.hubspot.com%2Fobject-settings%2Fset-up-and-customize-pipelines&ts=1795134588941&hubs_signup-url=knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines&hubs_signup-cta=cta_button)

Twitter Widget Iframe

Chat Widget

![Avatar of HubBot](https://www.hubspot.com/hs-fs/hubfs/HS_pictogramsChat_Bot_Sage_500px.png?width=108&height=108)

👋 What questions do you have about HubSpot?

* * *

Spam protection enabled