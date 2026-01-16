document.addEventListener('DOMContentLoaded', function() {
	if (typeof wpml_cookies !== 'undefined' && wpml_cookies) {
		for(var cookieName in wpml_cookies) {
			var cookieData = wpml_cookies[cookieName];
			document.cookie = cookieName + '=' + cookieData.value + ';expires=' + cookieData.expires + '; path=' + cookieData.path + '; SameSite=Lax';
		}
	}
});