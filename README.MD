# Unofficial Email Octopus API Wrapper

An unofficial promise-based wrapper for the Email Octopus API. 
It also includes methods to automatically generate campaigns, which is currently not supported by the official API.

## Getting Started

1. `npm install email-octopus`

## Example Code

    var EmailOctopus = require('email-octopus);
    
    var username = 'username';
    var password = 'password';
    var emailOctopus = new EmailOctopus(username, password);
    
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
    
    emailOctopus.createCampaign(campaignOptions, campaignHtml).then(function() {
        console.log('campaign created!');
    });