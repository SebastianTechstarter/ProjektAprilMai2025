$( document ).ready(function() {

    $('[button][switch-display-mode]').click(function(e) {  
        switch ($('body').attr('display-mode')) {
            case 'dark':
                $('body').attr('display-mode', 'light');
                break;
            default:
                $('body').attr('display-mode', 'dark');
                break;
        }
    });

});