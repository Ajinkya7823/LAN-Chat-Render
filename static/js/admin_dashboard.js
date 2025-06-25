$(document).ready(function() {
    // Check for pending requests and show badge if any
    function updatePendingRequestsBadge() {
        // Count rows with class table-warning (pending requests)
        let pending = $("table tr.table-warning").length;
        if (pending > 0) {
            $('#pending-requests-badge').show();
        } else {
            $('#pending-requests-badge').hide();
        }
    }
    updatePendingRequestsBadge();
    // Optionally, re-check after approving/rejecting
    $(document).on('submit', 'form', function() {
        setTimeout(updatePendingRequestsBadge, 500);
    });
    
    // Real-time notification for new user requests
    if (typeof io !== 'undefined') {
        var socket = io();
        socket.on('new_user_request', function(data) {
            // Show badge
            $('#pending-requests-badge').show();
            // Optionally, show a toast/alert
            if ($('#new-user-toast').length === 0) {
                $('body').append('<div id="new-user-toast" class="alert alert-info position-fixed top-0 end-0 m-3" style="z-index:9999;">New user request: <b>' + data.username + '</b></div>');
                setTimeout(function() { $('#new-user-toast').fadeOut(500, function() { $(this).remove(); }); }, 3500);
            }
        });
    }
});
