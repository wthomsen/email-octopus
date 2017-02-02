(function () {
  'use strict';

  var _ = require('lodash');
  var requestPromise = require('request-promise');
  var bluebird = require('bluebird');

  exports.EmailOctopus = (function () {
    function EmailOctopus(username, password) {
      this.username = username;
      this.password = password;
      this.cookieJar = {};
    }

    /**
     * Create a campaign on Email Octopus. Mimics the website's campaign creation flow
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
    EmailOctopus.prototype.createCampaign = function (options, bodyHtml) {
      var _this = this;

      return _this
          ._signIn()
          .then(function () {
            return _this._setupCampaign(options);
          })
          .then(function (campaignId) {
            return _this._selectTemplate(campaignId).then(function () {
              return _this._designCampaign(campaignId, bodyHtml);
            });
          })
          .finally(function () {
            _this._signOut();
          });
    };

    /**
     * Mimic sign-in process on Email Octopus website
     * @returns {*}
     * @private
     */
    EmailOctopus.prototype._signIn = function () {
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
                '_username': _this.username,
                '_password': _this.password,
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
    EmailOctopus.prototype._signOut = function () {
      var _this = this;

      return requestPromise({
        uri: 'https://emailoctopus.com/account/sign-out',
        method: 'GET',
        jar: _this.cookieJar
      });
    };

    /**
     * Mimic the first step of creating a campaign (https://emailoctopus.com/campaigns/setup)
     * @param {Object} [options] - The options associated with the campaign
     * @returns {*}
     * @private
     */
    EmailOctopus.prototype._setupCampaign = function (options) {
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

      return _this
          ._getPageToken(uri, tokenInputName)
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
     * Mimic template selection for a campaign (https://emailoctopus.com/campaigns/CAMPAIGN_ID/template)
     * @param {string} campaignId
     * @returns {*}
     * @private
     */
    EmailOctopus.prototype._selectTemplate = function (campaignId) {
      var _this = this;
      var uri = 'https://emailoctopus.com/campaigns/' + campaignId + '/template';
      var formData = {'campaign_template[template]': '3c3b6ab9-a0f7-11e6-b38e-080027632938'}; // "Totally Plain"
      var tokenInputName = 'campaign_template[_token]';

      return _this
          ._getPageToken(uri, tokenInputName)
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
    EmailOctopus.prototype._designCampaign = function (campaignId, bodyHtml) {
      var _this = this;
      var uri = 'https://emailoctopus.com/campaigns/' + campaignId + '/design';
      var formData = {'campaign_design[bodyHtml]': bodyHtml};
      var tokenInputName = 'campaign_design[_token]';

      return _this
          ._getPageToken(uri, tokenInputName)
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

    /**
     * Fetch the token hidden input value on an Email Octopus html form
     * @param {string} uri - The uri of the Email Octopus form
     * @param {string} tokenInputName - The name of the hidden input containing the token
     * @returns {*}
     * @private
     */
    EmailOctopus.prototype._getPageToken = function (uri, tokenInputName) {
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

    return EmailOctopus;
  })();

}).call(this);
