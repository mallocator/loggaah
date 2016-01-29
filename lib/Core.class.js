'use strict';

var _ = require('lodash');

var Plugins = require('./Plugins.class');


class Core {
    constructor() {
        this._events = [];
        this._loggers = {};
        this._rules = {};
    }

    /**
     * Register an existing logger in the system so that it can receive configuration updates.
     *
     * @param {Logger} logger
     */
    registerLogger(logger) {
        this._loggers[logger.name] = logger;
        for (let pattern in this._rules) {
            if (logger.name.match(pattern)) {
                logger.config = this._rules[pattern];
            }
        }
    }

    /**
     * Allows to set the entire configuration at once.
     *
     * @param {Object} configuration
     */
    configure(configuration) {
        for (let name in configuration.configurators) {
            this.configureConfigurator(name, configuration.configurators[name]);
        }
        for (let name in configuration.processors) {
            this.configureProcessor(name, configuration.processors[name]);
        }
        for (let name in configuration.appenders) {
            this.configureAppender(name, configuration.appenders[name]);
        }
        for (let pattern in configuration.loggers) {
            this.configureLogger(pattern, configuration.loggers[pattern]);
        }
    }

    /**
     * Configure a configurator using this method.
     *
     * @param {string} name
     * @param {Object} configuration
     * @returns {Configurator}
     * @throws Error when configurator was not found or instance could not be created
     */
     configureConfigurator(name, configuration) {
        try {
            var configurator = Plugins.getInstance(name, 'configurator');
            configurator.configuration = configuration;
            return configurator;
        } catch (e) {
            return Plugins.createInstance(configuration.type, name, configuration);
        }
    }

    /**
     * Configure a processor using this method.
     *
     * @param {string} name
     * @param {Object} configuration
     * @returns {Processor}
     * @throws Error when processor was not found or instance could not be created
     */
    configureProcessor(name, configuration) {
        try {
            var processor = Plugins.getInstance(name, 'processor');
            processor.configuration = configuration;
            return processor;
        } catch (e) {
            return Plugins.createInstance(configuration.type, name, configuration);
        }
    }

    /**
     *  Configure an appender using this method.
     *
     * @param {string} name
     * @param {Object} [configuration]
     * @returns {Appender}
     * @throws Error when appender was not found or instance could not be created
     */
    configureAppender(name, configuration) {
        try{
            var appender = Plugins.getInstance(name, 'appender');
            if (configuration) {
                if (configuration.type != appender.configuration.type) {
                    appender = Plugins.createInstance(configuration.type, name, configuration);
                } else {
                    appender.configuration = configuration;
                }
            }
            return appender;
        } catch(e) {
            return Plugins.createInstance(configuration.type, name, configuration);
        }
    }

    /**
     * Configure one or several loggers that match a given string or regex pattern.
     *
     * @param {String|RegExp} pattern
     * @param {Object} config
     */
    configureLogger(pattern, config) {
        this._rules[pattern] = config;
        for (let name in this._loggers) {
            if (name.match(pattern)) {
                this._loggers[name].config = config;
            }
        }
    }

    /**
     * Returns the configuration for a specific logger or an empty object.
     * @param {string} name
     * @returns {Object}
     */
    getLoggerConfig(name) {
        var config = {};
        for (let pattern in this._rules) {
            if (name.match(pattern)) {
                _.mergeWith(config, this._rules[pattern], (val1, val2) => {
                    if (_.isArray(val1)) {
                        return val1.concat(val2);
                    }
                    return [val1].concat(val2);
                });
            }
        }
        return this._rules[name] || {};
    }

    /**
     * Queues an event up for processing on next tick. If this is the first event to be added then an on tick listener
     * is registered.
     *
     * @param {Event} event
     */
    queueEvent(event) {
        if (!this._events.length) {
            process.nextTick(this.process);
        }
        this._events.push(event);
    }

    /**
     * This method is called at the end of the event loop and will process all queued up events.
     */
    process() {
        for (let event of this._events) {
            for (let pattern of this._loggers) {
                if (event.source.match(pattern)) {
                    for (let name of this._loggers[pattern].appenders) {
                        var appender = Plugins.getInstance(name, 'appender');
                        var processors = [];
                        for (let processorName of appender.configuration.processors) {
                            processors.push(Plugins.getInstance(processorName, 'processor'));
                        }
                        processors.push(appender);
                        this._processChain([event], processors);
                    }
                }
            }
        }
    }

    /**
     * Internal method to process the processor chain recursively and call the appender in the end.
     *
     * @param {Event[]} events
     * @param {Plugin[]} plugins
     * @private
     */
    _processChain(events, plugins) {
        var plugin = plugins.unshift();
        if (plugin instanceof Plugins.interfaces.Appender) {
            plugin.append(events);
        }
        if (plugin instanceof Plugins.interfaces.Processor) {
            plugin.process(events, (events) => {
                this._processChain(events, plugins);
            });
        }
    }
}

module.exports = new Core();