# Unofficial EmailOctopus API Wrapper

An unofficial promise-based wrapper for the [EmailOctopus](https://emailoctopus.com/?ali=2c247a50-e9eb-11e6-8561-06ead731d453) API. 
It also includes methods to automatically generate campaigns, which is currently not supported by the official API.

## Getting Started

1. `npm install email-octopus`
2. Include email-octopus as a dependency
3. Initialize wrapper using your API Key (optionally include username and password if you want to create campaigns)

## Example Code

Setup:

    var eo = require('email-octopus);
    var apiKey = 'yourKey';
    var username = 'username';
    var password = 'password';
    var emailOctopus = new eo.EmailOctopus(apiKey, username, password);
    
Add a contact to a list:

    var listId = 'some-uuid-for-this-list'
    var options = {
        email_address: 'john@doe.com'
        first_name: 'John',
        last_name: 'Doe'
    };
    
    emailOctopus.lists.contacts.create(listId, options).then(function() {
        console.log('contact added');
    });
    
Create a campaign (warning: unofficially supported by mimicking website flow):
    
    var campaignOptions = {
      name: 'My First Automated Campaign',
      subject: 'Hello Subscribers!',
      fromName: 'Johnny Marketer',
      fromEmailAddress: 'newsletter@somewhere.com', // must be validated by AWS
      openTrackingEnabled: true,
      linkClickTrackingEnabled: true,
      toPersonalisationEnabled: true
    };
    var campaignHtml = 
        '<!DOCTYPE html><html>' + 
            '<head><title>My Campaign</title></head>' +
            '<body style="font-family: Arial,Helvetica,sans-serif;">' + 
                '<p>Hello world.</p>' +
            '</body>' + 
        '</html>';
    
    emailOctopus.campaigns.create(campaignOptions, campaignHtml).then(function() {
        console.log('campaign created!');
    });
    
## Documentation

For full documentation with parameter specs, see the source file or the EmailOctopus API (v1.1) docs. The `options` 
parameter always maps to the parameters section for the corresponding endpoint in the official documentation.

### Lists

* lists.get([listId], [options])
* lists.create(options)
* lists.update(options)
* lists.delete(listId)
* lists.find(list) - Helper function to find a list given a list object (e.g., `{name: 'My Precious List'}`)

#### Contacts

* lists.contacts.get(listId, [contactId], [options])
* lists.contacts.create(listId, options)
* lists.contacts.update(listId, contactId, options)
* lists.contacts.delete(listId, contactId)
* lists.contacts.find(listId, contact) - Helper function to find a contact given a listId and a contact object (e.g., `{email_address: 'john@doe.com'}`)

### Campaigns

* campaigns.get([campaignId], [options])
* campaigns.create(options, html) - Unofficial function that mimics the website flow
* campaigns.find(campaign) - Helper function to find a campaign given a campaign object (e.g., `{subject: 'My Catchy Subject'}`)

#### Reports

* campaigns.reports.summary(campaignId, [options])
* campaigns.reports.bounced(campaignId, [options])
* campaigns.reports.clicked(campaignId, [options])
* campaigns.reports.complained(campaignId, [options])
* campaigns.reports.opened(campaignId, [options])
* campaigns.reports.sent(campaignId, [options])
* campaigns.reports.unsubscribed(campaignId, [options])
* campaigns.reports.notBounced(campaignId, [options])
* campaigns.reports.notClicked(campaignId, [options])
* campaigns.reports.notComplained(campaignId, [options])
* campaigns.reports.notOpened(campaignId, [options])
* campaigns.reports.notUnsubscribed(campaignId, [options])

## Error Handling

Rejected promises include the entire http request error object. Therefore, you can access the EmailOctopus API error object like this:
    
    emailOctopus.lists.contacts
        .create(listId, existingContact)
        .catch(function(err) {
            var eoError = err.error;
            console.log(eoError.code, eoError.message); 
            // MEMBER_EXISTS_WITH_EMAIL_ADDRESS A contact already exists with the supplied email address.
        }); 

## Support The Project

Want to support the project? If you decide to use EmailOctopus, create your account using our 
[affiliate link](https://emailoctopus.com/?ali=2c247a50-e9eb-11e6-8561-06ead731d453).