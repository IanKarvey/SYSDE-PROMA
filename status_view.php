<?php
// Database connection code here
$status = ""; // Get this from your database query

// Status badge styling
function getStatusBadgeClass($status) {
    switch(strtolower($status)) {
        case 'pending':
            return 'bg-warning';
        case 'rejected':
            return 'bg-danger';
        case 'approved':
            return 'bg-success';
        default:
            return 'bg-secondary';
    }
}
?>

<div class="status-container">
    <span class="badge <?php echo getStatusBadgeClass($status); ?>">
        <?php echo ucfirst($status); ?>
    </span>
    
    <?php if($status != 'rejected' && $status != 'approved'): ?>
        <form method="POST" action="cancel_request.php" style="display: inline;">
            <input type="hidden" name="request_id" value="<?php echo $request_id; ?>">
            <button type="submit" class="btn btn-danger btn-sm">Cancel Request</button>
        </form>
    <?php endif; ?>
</div>

<style>
.status-container {
    margin: 10px 0;
}
.badge {
    padding: 8px 12px;
    font-size: 14px;
    margin-right: 10px;
}
</style>
