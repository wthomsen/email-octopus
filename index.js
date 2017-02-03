(function () {
  'use strict';

  var _ = require('lodash');
  var requestPromise = require('request-promise');
  var bluebird = require('bluebird');
  var Campaigns;
  var Contacts;
  var Lists;
  var Reports;
  var Website;

  exports.EmailOctopus = (function () {
    /**
     * EmailOctopus API wrapper constructor
     * @param {string} apiKey - Your EmailOctopus API key
     * @param {string} [username] - Your EmailOctopus username (only needed if you want to create campaigns)
     * @param {string} [password] - Your EmailOctopus password (only needed if you want to create campaigns)
     * @constructor
     */
    function EmailOctopus(apiKey, username, password) {
      this.apiKey = apiKey || process.env.EMAILOCTOPUS_APIKEY;
      this.username = username || process.env.EMAILOCTOPUS_USERNAME;
      this.password = password || process.env.EMAILOCTOPUS_PASSWORD;
      this.cookieJar = {};
      this.campaigns = new Campaigns(this);
      this.lists = new Lists(this);
      this.website = new Website(this);
      this.uriRoot = 'https://emailoctopus.com/api/1.1';
    }

    /**
     * Sends request to EmailOctopus API
     * @param {string} path
     * @param {string} method
     * @param {Object} [options]
     * @returns {*}
     * @private
     */
    EmailOctopus.prototype._apiRequest = function (path, method, options) {
      var _this = this;

      options = _.extend({api_key: _this.apiKey}, options || {});

      return requestPromise({
        uri: _this.uriRoot + path,
        method: method,
        json: true,
        qs: method === 'GET' ? options : undefined,
        formData: method !== 'GET' ? options : undefined
      });
    };

    return EmailOctopus;
  })();

  Campaigns = (function () {
    function Campaigns(master) {
      this.master = master;
      this.reports = new Reports(master);
    }

    /**
     * https://emailoctopus.com/api-documentation/campaigns/get or
     * https://emailoctopus.com/api-documentation/campaigns/get-all
     * @param {string} [campaignId]
     * @param {Object} [options]
     * @param {number} [options.limit=100]
     * @param {number} [options.page=1]
     * @returns {*}
     */
    Campaigns.prototype.get = function (campaignId, options) {
      var _this = this;
      var path = '/campaigns' + (campaignId ? '/' + campaignId : '');

      return _this.master._apiRequest(path, 'GET');
    };

    /**
     * WARNING: Unofficial API add-on. Creates a campaign by mimicing the website's campaign creation flow
     * @param {Object} [options] - The options associated with the campaign
     * @param {string} [options.name] - The name of the campaign
     * @param {string} [options.subject] - The subject of the campaign
     * @param {string} [options.fromName] - The from Name of the campaign
     * @param {string} [options.fromEmailAddress] - The from email address (will need to be validated in AWS)
     * @param {bool} [options.openTrackingEnabled] - Whether to track opens
     * @param {bool} [options.linkClickTrackingEnabled] - Whether to track link clicks
     * @param {bool} [options.toPersonalisationEnabled] - Whether to enable personalisation
     * @param {string} bodyHtml - the entire html of the email
     * @returns {*}
     */
    Campaigns.prototype.create = function (options, bodyHtml) {
      var _this = this;

      return _this
          .master._signIn()
          .then(function () {
            return _this._setup(options);
          })
          .then(function (campaignId) {
            return _this._selectTemplate(campaignId).then(function () {
              return _this._design(campaignId, bodyHtml);
            });
          })
          .finally(function () {
            _this._signOut();
          });
    };

    /**
     * Mimic the first step of creating a campaign (https://emailoctopus.com/campaigns/setup)
     * @param {Object} [options] - The options associated with the campaign
     * @returns {*}
     * @private
     */
    Campaigns.prototype._setup = function (options) {
      var _this = this;
      var uri = 'https://emailoctopus.com/campaigns/setup';
      var tokenInputName = 'campaign_setup[_token]';

      // Extend defaults with user-defined options
      var campaignSetup = _.extend({
        name: 'Campaign Name',
        subject: 'Campaign Subject',
        fromName: 'From Name',
        fromEmailAddress: 'fromemail@domain.com',
        openTrackingEnabled: 1,
        linkClickTrackingEnabled: 1,
        toPersonalisationEnabled: 1
      }, options || {});

      // Replace booleans with integers
      _.each(campaignSetup, function (value, key) {
        if (typeof value === 'boolean') {
          campaignSetup[key] = value | 0;
        }
      });

      return _this
          .master.website._getPageToken(uri, tokenInputName)
          .then(function (token) {
            var formData = {};

            _.each(campaignSetup, function (val, key) {
              formData['campaign_setup[' + key + ']'] = val;
            });
            formData[tokenInputName] = token;

            return requestPromise({
              uri: uri,
              method: 'POST',
              jar: _this.cookieJar,
              formData: formData,
              resolveWithFullResponse: true,
              followAllRedirects: true
            }).then(function (response) {
              var finalUri = response.request.uri.href;
              var campaignIdMatch = finalUri.match(/\/campaigns\/([0-9a-z-]+)\//);
              var campaignId = campaignIdMatch ? campaignIdMatch[1] : null;
              return campaignId || bluebird.reject(new Error('Unable to locate newly created campaign ID.'));
            }, function () {
              return bluebird.reject(new Error('Unable to setup campaign.'));
            });
          });
    };

    /**
     * Mimic campaign template selection (https://emailoctopus.com/campaigns/CAMPAIGN_ID/template)
     * @param {string} campaignId
     * @returns {*}
     * @private
     */
    Campaigns.prototype._selectTemplate = function (campaignId) {
      var _this = this;
      var uri = 'https://emailoctopus.com/campaigns/' + campaignId + '/template';
      var formData = {'campaign_template[template]': '3c3b6ab9-a0f7-11e6-b38e-080027632938'}; // "Totally Plain"
      var tokenInputName = 'campaign_template[_token]';

      return _this
          .master.website._getPageToken(uri, tokenInputName)
          .then(function (token) {
            formData[tokenInputName] = token;
            return requestPromise({
              uri: uri,
              method: 'POST',
              formData: formData,
              followAllRedirects: true
            });
          });
    };

    /**
     * Mimic campaign design (https://emailoctopus.com/campaigns/CAMPAIGN_ID/design)
     * @param {string} campaignId
     * @param {string} bodyHtml
     * @returns {*}
     * @private
     */
    Campaigns.prototype._design = function (campaignId, bodyHtml) {
      var _this = this;
      var uri = 'https://emailoctopus.com/campaigns/' + campaignId + '/design';
      var formData = {'campaign_design[bodyHtml]': bodyHtml};
      var tokenInputName = 'campaign_design[_token]';

      return _this
          .master.website._getPageToken(uri, tokenInputName)
          .then(function (token) {
            formData[tokenInputName] = token;
            return requestPromise({
              uri: uri,
              method: 'POST',
              jar: _this.cookieJar,
              followAllRedirects: true,
              formData: formData
            });
          });
    };

    return Campaigns;
  })();

  Contacts = (function () {
    function Contacts(master) {
      this.master = master;
    }

    /**
     * https://emailoctopus.com/api-documentation/lists/get-contact or
     * https://emailoctopus.com/api-documentation/lists/get-all-contacts
     * @param {string} listId
     * @param {string} [contactId]
     * @param {Object} [options]
     * @param {number} [options.limit=100]
     * @param {number} [options.page=1]
     * @returns {*}
     */
    Contacts.prototype.get = function (listId, contactId, options) {
      var _this = this;
      var path = '/lists/' + listId + '/contacts' + (contactId ? '/' + contactId : '');

      return _this.master._apiRequest(path, 'GET');
    };

    /**
     * https://emailoctopus.com/api-documentation/lists/create-contact
     * @param {string} listId - The id of the list to add the contact to
     * @param {Object} options
     * @param {string} options.email_address - The email address of the contact
     * @param {string} [options.first_name] - The first name of the contact
     * @param {string} [options.last_name] - The last name of the contact
     * @param {bool} [options.subscribed=true] - The initial subscribed status of the contact
     * @returns {*}
     */
    Contacts.prototype.create = function (listId, options) {
      var _this = this;
      var path = '/lists/' + listId + '/contacts';

      return _this.master._apiRequest(path, 'POST', options);
    };

    /**
     * https://emailoctopus.com/api-documentation/lists/update-contact
     * @param {string} listId
     * @param {string} contactId
     * @param {Object} options
     * @param {string} [options.email_address] - The new email address for the contact
     * @param {string} [options.first_name] - The new first name for the contact
     * @param {string} [options.last_name] - The new last name for the contact
     * @param {bool} [options.subscribed] - The new subscribed status for the contact
     * @returns {*}
     */
    Contacts.prototype.update = function (listId, contactId, options) {
      var _this = this;
      var path = '/lists/' + listId + '/contacts/' + contactId;

      return _this.master._apiRequest(path, 'PUT', options);
    };

    /**
     * https://emailoctopus.com/api-documentation/lists/delete-contact
     * @param {string} listId
     * @param {string} contactId
     * @returns {*}
     */
    Contacts.prototype['delete'] = function (listId, contactId) {
      var _this = this;
      var path = '/lists/' + listId + '/contacts' + contactId;

      return _this.master._apiRequest(path, 'DELETE');
    };

    return Contacts;
  })();

  Lists = (function () {
    function Lists(master) {
      this.master = master;
      this.contacts = new Contacts(master);
    }

    /**
     * https://emailoctopus.com/api-documentation/lists/get or
     * https://emailoctopus.com/api-documentation/lists/get-all
     * @param {string} [listId]
     * @param {Object} [options]
     * @param {number} [options.limit=100] - Number of lists to return
     * @param {number} [options.page=1] - Page to return records from
     * @returns {*}
     */
    Lists.prototype.get = function (listId, options) {
      var _this = this;
      var path = '/lists' + (listId ? '/' + listId : '');

      return _this.master._apiRequest(path, 'GET', options);
    };

    /**
     * https://emailoctopus.com/api-documentation/lists/create
     * @param {Object} options
     * @param {string} options.name - The name of the new list
     * @returns {*}
     */
    Lists.prototype.create = function (options) {
      var _this = this;
      var path = '/lists';

      return _this.master._apiRequest(path, 'POST', options);
    };

    /**
     * https://emailoctopus.com/api-documentation/lists/update
     * @param {string} listId
     * @param {Object} options
     * @param {Object} options.name - The new name for the list
     * @returns {*}
     */
    Lists.prototype.update = function (listId, options) {
      var _this = this;
      var path = '/lists/' + listId;

      return _this.master._apiRequest(path, 'PUT', options);
    };

    /**
     * https://emailoctopus.com/api-documentation/lists/delete
     * @param {string} listId - The id of the list to delete
     * @returns {*}
     */
    Lists.prototype['delete'] = function (listId) {
      var _this = this;
      var path = '/lists/' + listId;

      return _this.master._apiRequest(path, 'DELETE');
    };

    return Lists;
  })();

  Reports = (function () {
    function Reports(master) {
      this.master = master;
    }

    var reportTypes = [
      'summary',
      'bounced',
      'clicked',
      'complained',
      'opened',
      'sent',
      'unsubscribed',
      'not-bounced',
      'not-clicked',
      'not-complained',
      'not-opened',
      'not-unsubscribed'
    ];

    // Batch generate methods for the various report endpoints
    _.each(reportTypes, function (reportType) {
      /**
       * Retrieve a campaign report for a
       * @param {string} campaignId
       * @param {Object} [options]
       * @param {number} [options.limit=100]
       * @param {number} [options.page=1]
       * @returns {*}
       */
      Reports.prototype[_.camelCase(reportType)] = function (campaignId, options) {
        var _this = this;
        var path = '/campaigns/' + campaignId + '/reports/' + reportType;

        return _this.master._apiRequest(path, 'GET', options);
      };
    });

    return Reports;
  })();

  Website = (function () {
    function Website(master) {
      this.master = master;
    }

    /**
     * Mimic sign-in process on Email Octopus website
     * @returns {*}
     * @private
     */
    Website.prototype._signIn = function () {
      var _this = this;
      var uri = 'https://emailoctopus.com/account/sign-in';

      // Reset cookie jar
      _this.cookieJar = requestPromise.jar();

      return _this
          ._getPageToken(uri, '_token')
          .then(function (token) {
            return requestPromise({
              uri: uri,
              method: 'POST',
              jar: _this.cookieJar,
              followAllRedirects: true,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              formData: {
                '_username': _this.master.username,
                '_password': _this.master.password,
                '_token': token,
                '_remember_me': '1'
              }
            }).then(undefined, function (response) {
              return bluebird.reject(new Error('sign in failed'));
            });
          });
    };

    /**
     * Mimic sign-out process on Email Octopus website
     * @returns {*}
     * @private
     */
    Website.prototype._signOut = function () {
      var _this = this;

      return requestPromise({
        uri: 'https://emailoctopus.com/account/sign-out',
        method: 'GET',
        jar: _this.cookieJar
      });
    };

    /**
     * Fetch the token hidden input value on an Email Octopus html form
     * @param {string} uri - The uri of the Email Octopus form
     * @param {string} tokenInputName - The name of the hidden input containing the token
     * @returns {*}
     * @private
     */
    Website.prototype._getPageToken = function (uri, tokenInputName) {
      var _this = this;

      return requestPromise({
        method: 'GET',
        uri: uri,
        jar: _this.cookieJar
      }).then(function (response) {
        var tokenRegex = new RegExp('name="' + tokenInputName.replace('[', '\\[') + '"\\svalue="(.*)"');
        var match = response.match(tokenRegex);

        return match[1];
      });
    };

    return Website;
  })();
}).call(this);