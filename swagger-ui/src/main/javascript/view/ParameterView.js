'use strict';

SwaggerUi.Views.ParameterView = Backbone.View.extend({
    initialize: function () {
        Handlebars.registerHelper('isArray', function (param, opts) {
            if (param.type.toLowerCase() === 'array' || param.allowMultiple) {
                return opts.fn(this);
            } else {
                return opts.inverse(this);
            }
        });
    },

    render: function () {
        var type = this.model.type || this.model.dataType;

        if (typeof type === 'undefined') {
            var schema = this.model.schema;
            if (schema && schema.$ref) {
                var ref = schema.$ref;
                if (ref.indexOf('#/definitions/') === 0) {
                    type = ref.substring('#/definitions/'.length);
                } else {
                    type = ref;
                }
            }
        }

        this.model.type = type;
        this.model.paramType = this.model.in || this.model.paramType;
        this.model.isBody = this.model.paramType === 'body' || this.model.in === 'body';
        this.model.isFile = type && type.toLowerCase() === 'file';

        // Allow for default === false
        if (typeof this.model.default === 'undefined') {
            this.model.default = this.model.defaultValue;
        }

        if (typeof this.model.example === 'undefined' && typeof this.model.schema !== 'undefined' && typeof this.model.schema.example !== 'undefined') {
            this.model.example = this.model.schema.example
        }

        this.model.hasDefault = (typeof this.model.default !== 'undefined');
        this.model.valueId = 'm' + this.model.name + Math.random();

        if (this.model.allowableValues) {
            this.model.isList = true;
        }

        var template = this.template();
        $(this.el).html(template(this.model));

        var signatureModel = {
            sampleJSON: this.model.sampleJSON,
            isParam: true,
            signature: this.model.signature
        };

        if (this.model.sampleJSON) {
            var signatureView = new SwaggerUi.Views.SignatureView({ model: signatureModel, tagName: 'div' });
            $('.model-signature', $(this.el)).append(signatureView.render().el);
        }
        else {
            $('.model-signature', $(this.el)).html(this.model.signature);
        }

        var isParam = false;

        if (this.model.isBody) {
            isParam = true;
        }

        var contentTypeModel = {
            isParam: isParam
        };

        contentTypeModel.consumes = this.model.consumes;

        if (isParam) {
            var parameterContentTypeView = new SwaggerUi.Views.ParameterContentTypeView({ model: contentTypeModel });
            $('.parameter-content-type', $(this.el)).append(parameterContentTypeView.render().el);
        }

        else {
            var responseContentTypeView = new SwaggerUi.Views.ResponseContentTypeView({ model: contentTypeModel });
            $('.response-content-type', $(this.el)).append(responseContentTypeView.render().el);
        }

        this.initAceEditor()

        return this;
    },
    initAceEditor: function () {
        var self = this

        if (this.model.isBody && (this.model.signature !== 'integer' && this.model.signature !== 'string')) {
            var textarea = $('.body-textarea', $(this.el));

            if (textarea && textarea.length) {
                setTimeout(function () {
                    var editDiv = $('<div>', {
                        position: 'absolute',
                        width: textarea.width(),
                        height: textarea.height(),
                        fontFamily: "monospace",
                        'class': textarea.attr('class')
                    }).insertBefore(textarea);
                    textarea.css('visibility', 'hidden');
                    textarea.css('height', '10px');
                    var editor = ace.edit(editDiv[0]);

                    //editor.container.style.fontFamily = "monospace !important"
                    editor.$blockScrolling = Infinity
                    editor.autoScrollEditorIntoView = true,

                    editor.renderer.setShowGutter(false);
                    editor.getSession().setValue(textarea.val());
                    editor.getSession().setMode("ace/mode/json");
                    editor.setTheme("ace/theme/twilight");

                    // copy back to textarea on form submit...
                    textarea.closest('form').submit(function () {
                        textarea.val(editor.getSession().getValue());
                    })

                    editor.getSession().on('change', function (e) {
                        textarea.val(editor.getSession().getValue());
                    });
                }, 200)
            }
        }
    },

    // Return an appropriate template based on if the parameter is a list, readonly, required
    template: function () {
        if (this.model.isList) {
            return Handlebars.templates.param_list;
        } else {
            if (this.options.readOnly) {
                if (this.model.required) {
                    return Handlebars.templates.param_readonly_required;
                } else {
                    return Handlebars.templates.param_readonly;
                }
            } else {
                if (this.model.required) {
                    return Handlebars.templates.param_required;
                } else {
                    return Handlebars.templates.param;
                }
            }
        }
    }
});