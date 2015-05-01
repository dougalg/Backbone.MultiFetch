// Usage:
//
// var f = new MultiFetch(collection, {});
//
// f.add(mycomment, options)
//  .add(c1, options)
//  .add(collection, options)
//  .success(function() {
//      collection.add(mycomment);
//      collection.add(c1);
//  })
define([
    'jquery',
    'lodash'
], function($, _){

    var defaultSuccess = function(models, parsedResults) {
        this.collection.add(models);
        this.collection.trigger('sync');
    };

    function multiFetch(collection, options, fetchFunc) {
        this.collection = collection;
        this.Model = collection.model;
        this.count = 0;
        this.parsedResults = [];
        this.models = [];
        this.errors = [];
        this.defaultOptions = _.defaults({}, options, {
            silent: true,
            success: function(){},
            error: function(){}
        });
        this.fetchFunc = fetchFunc || 'fetch';
        this.hasSuccess = false;
        this.hasError = false;
        this.successFunc = defaultSuccess.bind(this);
        return this;
    }

    multiFetch.prototype.processAddition = function(item, options, fetchFunc) {
        options = _.clone(options || {});
        // If it is a string, try to call the method on the collection with that name
        if (_.isString(item) &&  this.collection[item] !== undefined && _.isFunction(this.collection[item])) {
            fetchFunc = item;
            options.add = options.add || false;
            options.remove = options.remove || false;
            return [this.collection, options, fetchFunc];
        }
        // If it is an id, create the model and pass it in
        if ($.isNumeric(item)) {
            var x = parseInt(item);
            if (x % 1 === 0) {
                return [new this.Model({id: item}), options, fetchFunc];
            }
        }
        if (item instanceof this.Model) {
            return [item, options, fetchFunc];
        }
        return undefined;
    };

    multiFetch.prototype.add = function(parents, options, fetchFunc) {
        parents = arrayUpdate([], parents);
        if (parents.length < 1) {
            return this;
        }
        _.each(parents, function(parent) {
            this.addSingle.apply(this, this.processAddition(parent, options, fetchFunc));
        }.bind(this));
        return this;
    };

    multiFetch.prototype.addSingle = function(parent, options, fetchFunc) {
        if (parent === undefined) {
            return this;
        }
        _.defaults(options, this.defaultOptions);
        fetchFunc = fetchFunc || this.fetchFunc;

        this.count += 1;

        var successFunc = options.success;
        var errorFunc = options.error;

        var that = this;
        options.success = this.getSuccessFunc(parent, successFunc, options);
        options.error = this.getErrorFunc(parent, errorFunc);

        parent[fetchFunc](options);

        return this;
    };

    multiFetch.prototype.getSuccessFunc = function(parent, successFunc) {
        return function(model, response, opts) {
            this.hasSuccess = true;
            this.updateResults(parent, response, opts);
            this.updateModels(parent, response, opts);
            successFunc.apply(parent, arguments);
            this.complete();
        }.bind(this);
    };

    multiFetch.prototype.getErrorFunc = function(parent, errorFunc) {
        return function(model, response) {
            this.hasError = true;
            this.errors.push(response);
            errorFunc.apply(parent, arguments);
            this.complete();
        }.bind(this);
    };

    multiFetch.prototype.complete = function() {
        this.count -= 1;
        if (this.count === 0) {
            if (this.hasSuccess) {
                this.successFunc(this.models, this.parsedResults, this.errors);
            }
            else if (this.hasError) {
                this.errorFunc(this.models, this.parsedResults, this.errors);
            }
        }

        return this;
    };

    multiFetch.prototype.updateResults = function(parent, response, options) {
        var results = parent.parse(response, options);
        arrayUpdate(this.parsedResults, results);
        return results;
    };

    multiFetch.prototype.updateModels = function(parent, response, options) {
        // If this is just a model, we're good
        if (parent instanceof this.Model) {
            this.models.push(parent);
        }
        // If we have a collection fetchLike, create models from the result
        _.each(arrayUpdate([], parent.parse(response, options)), function(resp) {
            this.models.push(new this.Model(resp, options));
        }.bind(this));
    };

    // Run if ANY fetch succeeds
    multiFetch.prototype.success = function(fn) {
        this.successFunc = fn;
        return this;
    };

    // Run if ALL fetches failed
    multiFetch.prototype.error = function(fn) {
        this.errorFunc = fn;
        return this;
    };

    return multiFetch;

    function arrayUpdate(arr, items) {
        if (!_.isArray(items)) {
            items = [items];
        }
        Array.prototype.push.apply(arr, items);
        return arr;
    }
});
