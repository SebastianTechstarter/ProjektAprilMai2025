$( document ).ready(() => {

    const $body =         $( 'body' );
    const $main =         $( '[main]' );
    const $login =        $( '[login]' );
    const $register =     $( '[register]' );
    const $shoppingCart = $( '[shopping-cart]' );
    const $container =    $( '[quick-category]' );

    const chunkSize = 8;
    const $buttons = $container.children('div');
    let currentIndex = 0;
    $buttons.hide();

    function showNextChunk() {
        const $nextChunk = $buttons.slice(currentIndex, currentIndex + chunkSize);
        $nextChunk.show();
        currentIndex += chunkSize;
        if (currentIndex >= $buttons.length) {
            $( '[button="more"]' ).remove();
        }
    }

    showNextChunk();

    // Create and append "..." button
    const $moreButton = $('<div button="more"><i class="fa fa-caret-down" aria-hidden="true"></i></div>');
    $container.append($moreButton);

    // Click handler
    $moreButton.on('click', showNextChunk);

    $( '[button]' ).on( "click", function() {
        switch ($( this ).attr('button')) {
            case 'switch:background':
                switchBackground($body.attr('background'));
                break;
            case 'show:login':
                showLogin();
                break;
            case 'hide:login':
                hideLogin();
                break;
            case 'show:shopping-cart':
                showShoppingCart();
                break;
            case 'hide:shopping-cart':
                hideShoppingCart();
                break;
            case 'show:register':
                hideLogin();
                showRegister();
                break;
            case 'hide:register':
                hideRegister();
                break;
        }
    });

    function switchBackground($id) {
        $random = Math.floor((Math.random() * 5) + 1);
        if ($id == $random) {
            switchBackground($id);
        }
        else {
            $body.attr('background', $random);
        }
    }

    function showLogin() {
        $login.css('display', 'flex');
    }

    function hideLogin() {
        $login.css('display', 'none');
    }

    function showShoppingCart() {
        $shoppingCart.css('display', 'flex');
    }

    function hideShoppingCart() {
        $shoppingCart.css('display', 'none');
    }

    function showRegister() {
        $register.css('display', 'flex');
    }

    function hideRegister() {
        $register.css('display', 'none');
    }

    //------------------------------------------------------------------------
    //BUCH COVER

    $('[article]').each(function() {
        let bookCover = $(this).attr('book-cover');
        $(this).css('background-image', 'url(../images/book_' + bookCover + '/front.png)');
    });



});