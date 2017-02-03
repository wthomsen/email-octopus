# Unofficial Email Octopus API Wrapper

An unofficial promise-based wrapper for the Email Octopus API. 
It also includes methods to automatically generate campaigns, which is currently not supported by the official API.

## Getting Started

1. `npm install email-octopus`
2. Include email=octopus as a dependency
3. Initialize wrapper using your API Key (optionally include username and password if you want to create campaigns)

## Example Code

Setup

    var eo = require('email-octopus);
    var apiKey = 'yourKey';
    var username = 'username';
    var password = 'password';
    var emailOctopus = new eo.EmailOctopus(apiKey, username, password);
    
Add a contact to a list

    var listId = 'some-uuid-for-this-list'
    var options = {
        email_address: 'john@doe.com'
        first_name: 'John',
        last_name: 'Doe'
    };
    
    emailOctopus.lists.contacts.create(listId, options).then(function() {
        console.log('contact added');
    });
    
Create a campaign (warning: unofficial supported by mimicking website flow)
    
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

For full documentation with parameter specs, see the source file or the EmailOctopus API (v1.1) docs.

### Lists

* lists.get([listId], [options])
* lists.create(options)
* lists.update(options)
* lists.delete(listId)

#### Contacts

* lists.contacts.get(listId, [contactId], [options])
* lists.contacts.create(listId, options)
* lists.contacts.update(listId, contactId, options)
* lists.contacts.delete(listId, contactId)

### Campaigns

* campaigns.get([campaignId], [options])
* campaigns.create(options, html)

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


