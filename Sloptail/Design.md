# Purpose
AI happy hour at work, as part of a demo series. Format: people giving talks/demos, bar up the back of the auditorium. 60-70 attendees. 

This is either the first or last of the demos (depending on whether we want people to be getting drinks during talks or not).

Web app attendees can access from their (personal) phones, lets them order a drink with an AI-generated recipe. Cafe-style system where they put in their name, and get their drink when it's called out. 

## Goals
 * Drinks need to be interesting and good
 * AI must be actually part of the process that produces them
 * Logistics have to work for this sized audience
	 * Web app shouldn't crash under 70-user load
	 * Bartending logistics should be optimized for throughput
 * Experience should be fun

# Architecture
* Web server: stores users / orders; queries AI (through openrouter probably)
* Web client (user-facing): takes name & order; notifies when ready
	* some kind of cookie-type thing to remember user & prev orders (not sure what should be stored server vs client side)
* Web client (bar-facing): displays ordered recipes, has a way to report that it's ready.
	* should parallelize to multiple bartenders (each makes a different drink) - unclear whether parallel or serial is more efficient
	* similarly, one bartender making multiple drinks at once might be more efficient; not sure how to support this. Ideally could group to drinks with similar ingredients somehow?

## RPCs (web server hosted)
From users:
* Propose: user name; preferences (represented somehow) -> recipe
* Edit: recipe; user-suggested tweak -> recipe
* Submit: recipe -> ack received; promise/similar resolved when ready

From bar:
* Poll for incoming orders
* Mark order ready
* Out of x: ingredient -> ack (server removes ingredient from available set)

## Types
* Ingredient: name, flavor profile, + type-dependent fields:
	* Base: abv
	* Mixer: -
	* Flavoring: alcoholic-or-not, unit (drops, dashes, pumps etc)
	* Garnish: -
* Recipe: ingredient -> amount (in relevant units for that ingredient / 'fill with') map. 
* User request: 
	* Alcohol target: Mocktail (no alc / low alc), Cocktail (half / full strength)
	* Weirdness target: either 1-3 or 1-5, not sure
	* String
* Proposal: recipe, name, description

# UX
## For users
* What's your name
* Mocktail / cocktail
	* if mocktail, zero alc or is a dash of bitters ok
	* if cocktail, full or half strength?
* How adventurous are you feeling? (not at all / get creative / fuck my shit up)
	* If not at all, just give them a list of standard cocktails we can make + a button to say 'ok maybe I'm feeling more adventurous than that'
* Prompt box / what do you feel like?
	* Could have a few prewritten examples you can tap as well, maybe?
* loading spinner while wait for llm
* proposal: name, subtitle = whatever your prompt was, recipe, description. text box for corrections / button to submit
* on submit: we're making your (name); will notify you when it's ready
* also add a sidebar / menu button where you can see your past orders
	* button to reorder which pulls up the proposal again (so you can tweak from there if you want)
	* + new order button. can reset alc/adventurousness or keep. 
* general UX vibe: low-profile graphics, slightly tongue-in-cheek

## For bar
Really not sure (even what device they'll have up there), needs to be optimized for efficiency in data presentation & ux. 


# Tech details
new github repo (this one can be public)
not sure re webserver deployment (probably cloudflare?); openrouter api key in env var or similar not code
not sure re language/tech stack
want nice structure: components library for ux, big state machine in server tracking order state (exposing appropriate functions to mutate but otherwise things are pure), llm interaction in separate independently-testable library