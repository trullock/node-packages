export default function(language){

	HTMLFormElement.prototype.ajaxSubmit = function (options) {
		options = options || {};

		var $form = this;

		// reset validation
		var $inputs = $form.querySelectorAll('input, select, textarea');
		$inputs.forEach($input => $input.resetValidity());

        var url = $form.action;
		if (url === '')
			url = window.location.href;

		var method = $form.method || 'get';

		var formData = new FormData($form);
		var urlEncoded = new URLSearchParams();

		for (const [key, value] of formData)
			urlEncoded.append(key, value);
		
		if(options.formData){
			for(const key in options.formData)
			urlEncoded.set(key, options.formData[key]);
		}

		$form.dispatchEvent(new CustomEvent('submitted', { 
			detail: options.button,
			bubbles: true 
		}))

		return submit($form, url, urlEncoded, method, false)
			.then(function (response) {
				return response.json().catch(function () { return null; }).then(function (data) {
					return {
						status: response.status,
						data: data,
						button: options.button
					};
				});
			})
			.then(result => $form.dispatchEvent(new CustomEvent('submission-complete', { 
				detail: result,
				bubbles: true
			})));
	};


	HTMLFormElement.prototype.makeAjaxSubmit = function () {
		var $form = this;

        $form.enableSubmitButtonTracking();

		$form.addEventListener('submit', function (e) {
			e.preventDefault();

			var confirmMessage = $form.dataset['confirm'];
			if(confirmMessage && !confirm(confirmMessage))
				return false;

			var options = {
				formData: {},
				button: $form.clickedButton
			};

			if ($form.clickedButton) {
				if ($form.clickedButton.name)
					options.formData[$form.clickedButton.name] = $form.clickedButton.value;
				$form.clickedButton = null;
			}

			$form.ajaxSubmit(options);
			return false;
		});

	}

	HTMLFormElement.prototype.enableSubmitButtonTracking = function () {
        var $form = this;
        var $submitButtons = $form.querySelectorAll('button[type=submit], button:not([type])');

        for (var i = 0; i < $submitButtons.length; i++) {
            var $button = $submitButtons[i];
            $button.addEventListener('click', function(e) {
                $form.clickedButton = e.target.matches('button') ? e.target : e.target.closest('button');
            });
        }
    }

	HTMLFormElement.prototype.setValidationResult = function (errors) {

		var $inputs = this.querySelectorAll('input, select, textarea');
		$inputs.forEach($input => $input.setValid());

		var erroneousInputs = [];

		for (var name in errors) {
			if (!errors.hasOwnProperty(name))
				continue;

			var $currentInputs = this.querySelectorAll('[name="' + name + '"]');
			if ($currentInputs.length === 0)
				continue;

			var isInError = errors[name].length > 0;

			$currentInputs.forEach(function ($currentInput, i) {
				// Hack to only show the error message on the first input, need more use cases to work out what a good solution here is.
				// Currently used on checkbox lists
				$currentInput.setInvalid(i == 0 ? errors[name] : null);
				if (isInError)
					erroneousInputs.push($currentInput);
			});
		}

		return erroneousInputs;
	};

	HTMLFormElement.prototype.submitHandler = function(fn){
		this.enableSubmitButtonTracking();
		this.addEventListener('submit', e => {
			e.preventDefault();

			if(this.validate())
			{
				this.setSubmitting(true);
				fn.call(this, this);
			}
		});
	}


	HTMLFormElement.prototype.validate = function () {
		let $inputs = [...this.querySelectorAll('input, select, textarea')];
		let valid = $inputs.reduce((agg, $input) => $input.validate() && agg, true);

		if(!valid)
			$inputs.filter($i => $i.matches('.is-invalid'))[0].focus();
		
		return valid;
	};

	let formReset = HTMLFormElement.prototype.reset;
	HTMLFormElement.prototype.reset = function () {
		formReset.call(this);
		var $inputs = this.querySelectorAll('input, select, textarea');
		return $inputs.forEach($i => {
			$i.resetValidity();
		})
	};

	HTMLInputElement.prototype.validate = function () {
		if(this.disabled || this.readOnly || this.hidden)
		{
			this.setValid();
			return true;
		}

		if(this.type != 'checkbox' && this.type != 'radio')
		{
			if (this.required && !this.value) {
				this.setInvalid(language.required)
				return false
			}
			
			if(this.minLength)
			{
				let minLength = parseInt(this.minLength, 10);
				if(this.value.length < minLength){
					this.setInvalid(language.minLength(minLength))
					return false;
				}
			}


			if(this.pattern)
			{
				let pattern = new RegExp(this.pattern, 'ig');
				if(!pattern.test(this.value)){
					this.setInvalid(language.invalidFormat)
					return false;
				}
			}


			if(this.type == 'email')
			{
				if(!this.checkValidity()) {
					this.setInvalid(language.invalidEmail)
					return false;
				}
			}
		} 
		else if(this.type == 'checkbox')
		{
			if(this.required && !this.checked){
				this.setInvalid(language.required)
				return false
			}
		}
		else if (this.type == 'radio') {
			if (!this.checkValidity()) {
				this.setInvalid(language.required)
				return false
			}
		}
		
		
		this.setValid();
		return true;
	};

	HTMLTextAreaElement.prototype.validate = function () {
		if(this.disabled || this.readOnly)
		{
			this.setValid();
			return true;
		}

		if (this.required && !this.value) {
			this.setInvalid(language.required)
			return false
		}

		this.setValid();
		return true;
	};

	HTMLSelectElement.prototype.validate = function () {
		if(this.disabled || this.readOnly)
		{
			this.setValid();
			return true;
		}

		if (this.required && !this.value) {
			this.setInvalid(language.required)
			return false
		}

		this.setValid();
		return true;
	};

	HTMLElement.prototype.setValid = function () {
		this.resetValidity();

		if (this.value === '')
			return;

		//this.classList.add('is-valid');
		this.setAttribute('aria-invalid', 'false');
		var $wrapper = this.closest('.form-group');
		if ($wrapper && $wrapper.classList.length > 0)
			$wrapper.classList.remove('field-validation-error');

        //var $message = this.findMessage();
		//if ($message)
		//	$message.classList.add('valid-feedback');
	};

	HTMLElement.prototype.setInvalid = function (message) {
		this.resetValidity();

		this.classList.add('is-invalid');
		this.setAttribute('aria-invalid', 'true');
		this.closest('.form-group').classList.add('field-validation-error');

        var $message = this.findMessage();

		if ($message) {
			$message.classList.add('invalid-feedback');
			$message.innerHTML = message;
		}
	};

	HTMLElement.prototype.resetValidity = function () {
		this.classList.remove('is-invalid', 'is-valid');
		this.setAttribute('aria-invalid', 'false');

		var $message = this.findMessage();
		if ($message) {
            $message.classList.remove('valid-feedback', 'invalid-feedback');
            $message.innerHTML = '';
        }

		var $wrapper = this.closest('.form-group');
		if ($wrapper && $wrapper.classList.length > 0)
			$wrapper.classList.remove('field-validation-error');
	};

	HTMLElement.prototype.findMessage = function() {
		var $field = this.closest('.form-group');
        if ($field) {
            var results = $field.querySelectorAll('.feedback');
            return results.length > 0 ? results[0] : null;
        }
        return null;
	}
	
	function submit($form, url, data, method) {
		if ($form.fetching)
			$form.fetching.cancel();

		var headers = new Headers();
		headers.append('Content-Type', 'application/x-www-form-urlencoded');
		
		var resolve, reject;
		$form.fetching = new Promise(function (rs, rj) {
			resolve = rs, reject = rj;
		});
		$form.fetching.cancel = function () {
			this.cancelled = true;
		};

		// create closure to capture scope
		(function () {
			var currentFetch = $form.fetching;
			// for debug
			currentFetch.url = url;

			fetch(url, {
				headers: headers,
				mode: 'cors',
				credentials: 'include',
				redirect: 'manual',
				method: method,
				body: data
			}).then(function () {
				$form.fetching = null;
				if (!currentFetch.cancelled)
					resolve.apply(window, arguments);
				else {
					reject.call(window, { status: 'aborted' });
				}
			}).catch(function () {
				$form.fetching = null;
				reject.apply(window, arguments);
			});
		}());

		return $form.fetching;
	}
	
	
    HTMLButtonElement.prototype.setSubmitting = function(submitting) {
        if(submitting)
        {         
            if(!this.$spinner)
            {
                this.$spinner = document.createElement('span');
                this.$spinner.classList.add('spinner-border', 'spinner-border-sm', 'ml-2');
                this.$spinner.setAttribute('role', 'status');
                this.$spinner.setAttribute('aria-hidden', 'true');
            }

            this.$fe = this.querySelector('.fe');
            if(this.$fe)
                this.replaceChild(this.$spinner, this.$fe);
            else
                this.appendChild(this.$spinner);

            this.disabled = true;
        }
        else
        {
            if(this.$spinner && this.$spinner.parentElement == this)
            {
                if(this.$fe)
                    this.replaceChild(this.$fe, this.$spinner);
                else
                    this.removeChild(this.$spinner);
            }

            this.disabled = false;
        }
    }

	HTMLFormElement.prototype.setSubmitting = function(submitting, $button) {
        
        $button = $button || this.clickedButton;
        
        if (submitting) {
			if($button)
                $button.setSubmitting(true);
                
            var $elements = this.querySelectorAll('input, select, textarea, button');

            for (let i = 0; i < $elements.length; i++) {
                $elements[i].originallyDisabled = $elements[i].disabled;
                $elements[i].disabled = true;
            }

		} else {
            var $elements = this.querySelectorAll('input, select, textarea, button');

            for (let i = 0; i < $elements.length; i++)
                $elements[i].disabled = $elements[i].originallyDisabled;

                if($button)
                    $button.setSubmitting(false);
        }

		this.dispatchEvent(new CustomEvent('submitting', { detail: { submitting }, bubbles: true} ));
    }

    HTMLFormElement.prototype.submitOnCtrlEnter = function () {
        var me = this;
        this.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter')
                me.dispatchEvent(new Event('submit'));
        });
	};


	HTMLFormElement.prototype.preventEnterSubmitting = function () {
		this.addEventListener('keydown', function (e) {
			if (e.key === 'Enter')
				e.preventDefault();
		});
	};

	
	HTMLElement.prototype.addCtrlEnterListener = function(cb, useCapture){
		return this.addEventListener('keydown', e => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'Enter')
				cb.call(this, e);
		}, useCapture || false);
	};
}