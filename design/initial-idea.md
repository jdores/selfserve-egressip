# Initial Idea

<!-- Describe your product idea here. -->
I want to create a solution for Cloudflare WARP users to be able to self select their egress location.

In order to do that I have created multiple egress policies already (manually on the dashboard). Each references a specific zero trust list.

The user should be able to access a web page (built on Cloudflare Workers) and protected by Access (I will configure the Access policy manually myself). The web page will display the different egress options available for the user, which will correspond to the self-serve egress policies I have created.

The worker should be able to retrieve the users email address from the Access token. When the user clicks on the the egress options (buttons), the worker will update the zero trust list that corresponds to the egress policy that corresponds to the location the user wants to egress from and assign the user to the list. The worker also needs to check the other existing lists and remove the user from them.

If it is helpful to keep track of user assignment to lists using a cloudflare KV store to improve the performance of the worker, then you can do that.

The webpage also has a button to disable the egress policy. When the user clicks on this button, the worker will remove the user from all the existing lists. Let's call this button the default location.

In summary from a code perspective you only need to concern yourself with updating the zero trust lists.

The list ids should be provided on the wrangler.toml file, alongside a name for their location. You should use this name as the name to be displayed in the buttons of the worker webpage.

## Zero trust list API references

The API endpoint for updating the entries of a zero trust list is:

PATH /accounts/{account_id}/gateway/lists/{list_id}
https://developers.cloudflare.com/api/resources/zero_trust/subresources/gateway/subresources/lists/methods/edit/

The account_id and the api_token should be stored as secrets in the worker. When we are deploying the worker ask me for that information in order to add these variables. Do not store them anywhere in the directory.

## On the UI for the webpage

The UI should look clean, modern and with great typography. It should have a title and a subtitle. Underneath the subtitle it should display the different egress options available for the user, which will correspond to the self-serve egress policies I have created. Each option should have a button to select it. 

It should also have on the footer a debug dropdown where we can see the user email address of the user visiting the website. And when the user has clicks on a button, the debug dropdown add the information about the name of the list where the user was assigned to and the name of the list the user was removed from. If he was removed from no list, then it should say N/A.

## Custom domain

The worker will be available at selfservegress.jdores.xyz and the worker dev hostnames should be disabled.

## Admin page

selfservegress.jdores.xyz/admin should provide the user with information about which users are assigned to each location.

I will create manually another Cloudflare Access application that restricts who can access /admin

## Zero trust lists and locations

"id": "d7e99b05-a207-4ae1-981a-9db2f6a12298" --> location = United Kingdom
"id": "bbea2d64-c173-4558-a314-6aaf7acde9d1" --> location = Germany
"id": "a0832bb1-4da8-4a66-b9c5-32b5963b48a1" --> location = United States (New York)
"id": "67a93ec7-9970-4c87-a537-a7ce6ec70277" --> location = Japan
"id": "04eeb115-ccf0-47f1-9e7f-9bc67c7a122e" --> location = Portugal