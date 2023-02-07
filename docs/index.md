# auth.js

* @module  
AuthButton Adds custom element for login/logout of Auth0, based on configuration below.
* @author  
cubap
 
* @description  
This module includes a custom `<button is="auth-button">` element for authentication within 
 the Dunbar Public Library and Archive Project.
* Notes: 
  - Include this module and a button[is='auth-button'] element to use. 
  - Add the `disabled` property on any page that should be available to the public, but knowing the user may be helpful.
  - This can be made more generic by passing in the constants and parameterizing {app:'dla'}.
